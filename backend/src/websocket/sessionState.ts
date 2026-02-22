import { SpeakerTranscript } from "../pipelines/summarization.js";

export interface SessionState {
  sessionId: string;
  teamId: string;
  teamName: string;
  participants: string[];
  transcriptSegments: SpeakerTranscript[];
  chunkCount: number;
  isPaused: boolean;
  lastSummaryChunkIndex: number;
  startedAt: Date;
}

export class SessionManager {
  private sessions = new Map<string, SessionState>();

  createSession(
    sessionId: string,
    teamId: string,
    teamName: string,
    participants: string[],
  ): SessionState {
    const state: SessionState = {
      sessionId,
      teamId,
      teamName,
      participants,
      transcriptSegments: [],
      chunkCount: 0,
      isPaused: false,
      lastSummaryChunkIndex: 0,
      startedAt: new Date(),
    };
    this.sessions.set(sessionId, state);
    return state;
  }

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionState>): SessionState | undefined {
    const state = this.sessions.get(sessionId);
    if (!state) return undefined;
    Object.assign(state, updates);
    return state;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  addTranscriptSegments(sessionId: string, segments: SpeakerTranscript[]): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.transcriptSegments.push(...segments);
    }
  }

  incrementChunkCount(sessionId: string): number {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.chunkCount += 1;
      return state.chunkCount;
    }
    return 0;
  }
}
