import { io, Socket } from "socket.io-client";
import type { TranscriptSegment, SpeakerDetection, HuddleSummary } from "../types";

export class WebSocketService {
  private static instance: WebSocketService;
  private socket: Socket | null = null;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(token: string, sessionId: string): Promise<void> {
    if (this.socket?.connected) {
      this.disconnect();
    }

    return new Promise((resolve, reject) => {
      this.socket = io("/huddle", {
        auth: { token, sessionId },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on("connect", () => {
        console.log("[WS] Connected to huddle session");
        resolve();
      });

      this.socket.on("disconnect", (reason) => {
        console.log("[WS] Disconnected:", reason);
      });

      this.socket.on("connect_error", (err) => {
        console.error("[WS] Connection error:", err.message);
        reject(err);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendAudioChunk(audioData: ArrayBuffer, sequenceNum: number, timestamp: number, mimeType: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("audio_chunk", { audioData, sequenceNum, timestamp, mimeType });
  }

  sendSessionControl(action: "start" | "pause" | "resume" | "end"): void {
    if (!this.socket?.connected) return;
    this.socket.emit("session_control", { action });
  }

  onTranscriptUpdate(callback: (data: { segments: TranscriptSegment[] }) => void): void {
    this.socket?.on("transcript_update", callback);
  }

  onSpeakerDetected(callback: (data: SpeakerDetection) => void): void {
    this.socket?.on("speaker_detected", callback);
  }

  onSummaryUpdate(callback: (data: { summary: HuddleSummary; isFinal: boolean }) => void): void {
    this.socket?.on("summary_update", callback);
  }

  onSessionStatus(callback: (data: { status: string; error?: string }) => void): void {
    this.socket?.on("session_status", callback);
  }

  onError(callback: (data: { message: string; code: string }) => void): void {
    this.socket?.on("error", callback);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
