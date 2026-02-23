export interface DiarizationConfig {
  serviceUrl: string;
  similarityThreshold: number;
  timeoutMs: number;
}

export interface SpeakerSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface DiarizationResult {
  segments: SpeakerSegment[];
}

interface RawDiarizationResponse {
  segments: Array<{
    speaker_label: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm;codecs=opus": ".webm",
  "audio/webm": ".webm",
  "audio/mp4": ".mp4",
  "audio/wav": ".wav",
  "audio/mpeg": ".mp3",
};

function getExtensionForMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? ".webm";
}

const DEFAULT_CONFIG: DiarizationConfig = {
  serviceUrl: process.env.DIARIZATION_SERVICE_URL ?? "http://localhost:8000/diarize",
  similarityThreshold: 0.65,
  timeoutMs: 30_000,
};

export class DiarizationService {
  private readonly config: DiarizationConfig;

  constructor(config: Partial<DiarizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async processChunk(audioBuffer: Buffer, sessionId: string, mimeType: string = "audio/webm"): Promise<DiarizationResult> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new DiarizationError("audioBuffer must not be empty");
    }

    const formData = new FormData();
    const ext = getExtensionForMime(mimeType);
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("audio", blob, `chunk${ext}`);
    formData.append("session_id", sessionId);
    formData.append("threshold", this.config.similarityThreshold.toString());

    console.log(`[Diarization] Sending ${audioBuffer.length} bytes to ${this.config.serviceUrl} (file=chunk${ext}, mime=${mimeType})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.serviceUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        console.error(`[Diarization] Service error ${response.status}: ${body}`);
        throw new DiarizationError(`Diarization service responded with ${response.status}: ${body}`);
      }

      const raw: RawDiarizationResponse = await response.json();
      console.log(`[Diarization] Returned ${raw.segments?.length ?? 0} speaker segments`);
      return this.normaliseResponse(raw);
    } catch (error: unknown) {
      if (error instanceof DiarizationError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new DiarizationError(`Diarization request timed out after ${this.config.timeoutMs}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new DiarizationError(`Failed to reach diarization service: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async enrollSpeaker(userId: string, audioBuffer: Buffer): Promise<void> {
    if (!userId) throw new DiarizationError("userId must not be empty");
    if (!audioBuffer || audioBuffer.length === 0) throw new DiarizationError("audioBuffer must not be empty");

    const enrollUrl = this.config.serviceUrl.replace(/\/diarize$/, "/enroll");
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" });
    formData.append("audio", blob, "enrollment.wav");
    formData.append("user_id", userId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(enrollUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        throw new DiarizationError(`Speaker enrollment failed with ${response.status}: ${body}`);
      }
    } catch (error: unknown) {
      if (error instanceof DiarizationError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new DiarizationError(`Failed to reach enrollment endpoint: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normaliseResponse(raw: RawDiarizationResponse): DiarizationResult {
    if (!raw || !Array.isArray(raw.segments)) {
      throw new DiarizationError("Invalid response shape from diarization service");
    }
    return {
      segments: raw.segments.map((s) => ({
        speakerLabel: s.speaker_label,
        startMs: s.start_ms,
        endMs: s.end_ms,
        confidence: s.confidence,
      })),
    };
  }
}

export class DiarizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiarizationError";
  }
}
