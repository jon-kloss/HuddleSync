import { create } from "zustand";
import { sessionsApi } from "../services/api";
import { WebSocketService } from "../services/websocket";
import { AudioCaptureService } from "../services/audio";
import type { HuddleSession, TranscriptSegment, HuddleSummary, SpeakerDetection } from "../types";

interface SessionState {
  currentSession: HuddleSession | null;
  sessions: HuddleSession[];
  transcriptSegments: TranscriptSegment[];
  currentSummary: HuddleSummary | null;
  currentSpeaker: SpeakerDetection | null;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  chunkCount: number;
  durationInterval: ReturnType<typeof setInterval> | null;

  startSession: (teamId: string, token: string) => Promise<string>;
  endSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  addTranscriptSegment: (segments: TranscriptSegment[]) => void;
  updateSummary: (summary: HuddleSummary) => void;
  setSpeaker: (speaker: SpeakerDetection) => void;
  loadSessions: (teamId: string) => Promise<void>;
  reset: () => void;
}

const wsService = WebSocketService.getInstance();
const audioService = new AudioCaptureService();

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessions: [],
  transcriptSegments: [],
  currentSummary: null,
  currentSpeaker: null,
  isRecording: false,
  isPaused: false,
  duration: 0,
  chunkCount: 0,
  durationInterval: null,

  startSession: async (teamId, token) => {
    const session = await sessionsApi.create(teamId);

    // Connect WebSocket
    wsService.connect(token, session.session_id);
    wsService.sendSessionControl("start");

    // Set up WebSocket listeners
    wsService.onTranscriptUpdate((data) => {
      get().addTranscriptSegment(data.segments);
    });
    wsService.onSpeakerDetected((data) => {
      get().setSpeaker(data);
    });
    wsService.onSummaryUpdate((data) => {
      get().updateSummary(data.summary);
    });

    // Set up audio capture
    audioService.onAudioChunk((base64Data, seqNum) => {
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      wsService.sendAudioChunk(buffer.buffer, seqNum, Date.now());
      set((s) => ({ chunkCount: s.chunkCount + 1 }));
    });

    await audioService.startRecording();

    // Start duration timer
    const durationInterval = setInterval(() => {
      set((s) => ({ duration: s.duration + 1 }));
    }, 1000);

    set({
      currentSession: session,
      isRecording: true,
      isPaused: false,
      duration: 0,
      chunkCount: 0,
      transcriptSegments: [],
      currentSummary: null,
      currentSpeaker: null,
      durationInterval,
    });

    return session.session_id;
  },

  endSession: async () => {
    const { currentSession, durationInterval } = get();

    await audioService.stopRecording();
    wsService.sendSessionControl("end");

    if (currentSession) {
      await sessionsApi.end(currentSession.session_id);
    }

    if (durationInterval) clearInterval(durationInterval);

    // Wait briefly for final summary before disconnecting
    setTimeout(() => {
      wsService.disconnect();
    }, 5000);

    set({ isRecording: false, isPaused: false, durationInterval: null });
  },

  pauseSession: () => {
    audioService.pauseRecording();
    wsService.sendSessionControl("pause");
    set({ isPaused: true });
  },

  resumeSession: () => {
    audioService.resumeRecording();
    wsService.sendSessionControl("resume");
    set({ isPaused: false });
  },

  addTranscriptSegment: (segments) => {
    set((s) => ({
      transcriptSegments: [...s.transcriptSegments, ...segments],
    }));
  },

  updateSummary: (summary) => {
    set({ currentSummary: summary });
  },

  setSpeaker: (speaker) => {
    set({ currentSpeaker: speaker });
  },

  loadSessions: async (teamId) => {
    const response = await sessionsApi.listForTeam(teamId);
    set({ sessions: response.sessions });
  },

  reset: () => {
    const { durationInterval } = get();
    if (durationInterval) clearInterval(durationInterval);
    set({
      currentSession: null,
      transcriptSegments: [],
      currentSummary: null,
      currentSpeaker: null,
      isRecording: false,
      isPaused: false,
      duration: 0,
      chunkCount: 0,
      durationInterval: null,
    });
  },
}));
