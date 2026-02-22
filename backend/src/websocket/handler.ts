import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { prisma } from "../services/prisma.js";
import { SessionManager } from "./sessionState.js";
import { PipelineOrchestrator } from "../pipelines/orchestrator.js";
import { DiarizationService } from "../pipelines/diarization.js";
import { TranscriptionService } from "../pipelines/transcription.js";
import { SummarizationService } from "../pipelines/summarization.js";
import { JwtPayload } from "../middleware/auth.js";

const CHUNKS_PER_SUMMARY = 12; // ~60 seconds at 5s chunks

export function setupWebSocket(io: Server): void {
  const sessionManager = new SessionManager();

  const diarization = new DiarizationService({
    serviceUrl: config.diarizationServiceUrl,
  });
  const transcription = new TranscriptionService({
    apiKey: config.whisperApiKey,
  });
  const summarization = new SummarizationService(config.anthropicApiKey);
  const orchestrator = new PipelineOrchestrator(diarization, transcription, summarization);

  const huddle = io.of("/huddle");

  // Auth middleware for Socket.IO
  huddle.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.data.user = decoded;
      socket.data.sessionId = socket.handshake.auth.sessionId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  huddle.on("connection", (socket: Socket) => {
    const { user, sessionId } = socket.data;
    console.log(`[WS] User ${user.userId} connected to session ${sessionId}`);

    if (sessionId) {
      socket.join(sessionId);
    }

    // Handle audio chunks
    socket.on("audio_chunk", async (data: { audioData: Buffer; sequenceNum: number; timestamp: number }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session || session.isPaused) return;

      try {
        const audioBuffer = Buffer.from(data.audioData);
        const result = await orchestrator.processAudioChunk(audioBuffer, sessionId);

        // Add segments to session state
        sessionManager.addTranscriptSegments(sessionId, result.segments);
        const chunkCount = sessionManager.incrementChunkCount(sessionId);

        // Emit transcript update
        huddle.to(sessionId).emit("transcript_update", {
          segments: result.segments.map((s) => ({
            speakerLabel: s.speakerLabel,
            text: s.text,
            startMs: s.startMs,
            endMs: s.endMs,
          })),
        });

        // Emit speaker detection events
        for (const seg of result.rawDiarization.segments) {
          huddle.to(sessionId).emit("speaker_detected", {
            speakerLabel: seg.speakerLabel,
            confidence: seg.confidence,
          });
        }

        // Store transcript in DB
        await updateTranscriptInDb(sessionId, session.transcriptSegments);

        // Generate incremental summary every CHUNKS_PER_SUMMARY chunks
        if (chunkCount % CHUNKS_PER_SUMMARY === 0 && session.transcriptSegments.length > 0) {
          try {
            const summary = await orchestrator.generateSummary(
              sessionId,
              session.transcriptSegments,
              true,
              session.teamName,
              session.participants,
            );

            huddle.to(sessionId).emit("summary_update", {
              summary,
              isFinal: false,
            });

            // Store incremental summary in DB
            await prisma.summary.create({
              data: {
                session_id: sessionId,
                content: summary as any,
                is_final: false,
              },
            });

            sessionManager.updateSession(sessionId, { lastSummaryChunkIndex: chunkCount });
          } catch (err) {
            console.error("[WS] Incremental summary failed:", err);
          }
        }
      } catch (err) {
        console.error("[WS] Audio chunk processing failed:", err);
        socket.emit("error", { message: "Audio processing failed", code: "PROCESSING_ERROR" });
      }
    });

    // Handle session control
    socket.on("session_control", async (data: { action: "start" | "pause" | "resume" | "end" }) => {
      switch (data.action) {
        case "start": {
          try {
            const dbSession = await prisma.huddleSession.findUnique({
              where: { session_id: sessionId },
              include: {
                team: { select: { name: true } },
                starter: { select: { display_name: true } },
              },
            });

            if (dbSession) {
              const teamMembers = await prisma.user.findMany({
                where: { team_id: dbSession.team_id },
                select: { display_name: true },
              });

              sessionManager.createSession(
                sessionId,
                dbSession.team_id,
                dbSession.team.name,
                teamMembers.map((m) => m.display_name),
              );

              huddle.to(sessionId).emit("session_status", { status: "ACTIVE" });
            }
          } catch (err) {
            console.error("[WS] Session start failed:", err);
            socket.emit("error", { message: "Failed to start session", code: "START_ERROR" });
          }
          break;
        }

        case "pause": {
          sessionManager.updateSession(sessionId, { isPaused: true });
          huddle.to(sessionId).emit("session_status", { status: "PAUSED" });
          break;
        }

        case "resume": {
          sessionManager.updateSession(sessionId, { isPaused: false });
          huddle.to(sessionId).emit("session_status", { status: "ACTIVE" });
          break;
        }

        case "end": {
          try {
            const session = sessionManager.getSession(sessionId);
            if (session && session.transcriptSegments.length > 0) {
              // Generate final summary
              const finalSummary = await orchestrator.generateSummary(
                sessionId,
                session.transcriptSegments,
                false,
                session.teamName,
                session.participants,
              );

              // Store final summary
              const dbSummary = await prisma.summary.create({
                data: {
                  session_id: sessionId,
                  content: finalSummary as any,
                  is_final: true,
                },
              });

              // Store speaker summaries
              if (finalSummary.speakers) {
                for (const speaker of finalSummary.speakers) {
                  await prisma.speakerSummary.create({
                    data: {
                      summary_id: dbSummary.summary_id,
                      speaker_label: speaker.speakerLabel,
                      yesterday: speaker.yesterday || "",
                      today: speaker.today || "",
                      blockers: speaker.blockers || [],
                      action_items: speaker.actionItems || [],
                    },
                  });
                }
              }

              huddle.to(sessionId).emit("summary_update", {
                summary: finalSummary,
                isFinal: true,
              });

              // Update session status
              await prisma.huddleSession.update({
                where: { session_id: sessionId },
                data: { status: "COMPLETED", ended_at: new Date() },
              });
            }

            huddle.to(sessionId).emit("session_status", { status: "COMPLETED" });
            sessionManager.deleteSession(sessionId);
          } catch (err) {
            console.error("[WS] Session end failed:", err);
            await prisma.huddleSession.update({
              where: { session_id: sessionId },
              data: { status: "FAILED" },
            }).catch(() => {});
            socket.emit("error", { message: "Failed to end session", code: "END_ERROR" });
          }
          break;
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[WS] User ${user.userId} disconnected from session ${sessionId}`);
    });
  });
}

async function updateTranscriptInDb(sessionId: string, segments: any[]): Promise<void> {
  try {
    await prisma.transcript.upsert({
      where: { session_id: sessionId },
      create: {
        session_id: sessionId,
        full_text: segments,
      },
      update: {
        full_text: segments,
      },
    });
  } catch (err) {
    console.error("[WS] Failed to update transcript in DB:", err);
  }
}
