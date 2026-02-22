export interface TranscriptionConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
}

interface WhisperVerboseResponse {
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
}

const DEFAULT_CONFIG: TranscriptionConfig = {
  apiKey: process.env.WHISPER_API_KEY ?? "",
  model: "whisper-1",
  timeoutMs: 60_000,
  baseUrl: "https://api.openai.com/v1",
};

export class TranscriptionService {
  private readonly config: TranscriptionConfig;

  constructor(config: Partial<TranscriptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<TranscriptionResult> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new TranscriptionError("audioBuffer must not be empty");
    }

    const url = `${this.config.baseUrl}/audio/transcriptions`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("model", this.config.model);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
    if (language) formData.append("language", language);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        throw new TranscriptionError(`Whisper API responded with ${response.status}: ${body}`);
      }

      const raw: WhisperVerboseResponse = await response.json();
      return this.normaliseResponse(raw);
    } catch (error: unknown) {
      if (error instanceof TranscriptionError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TranscriptionError(`Whisper API request timed out after ${this.config.timeoutMs}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new TranscriptionError(`Failed to reach Whisper API: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normaliseResponse(raw: WhisperVerboseResponse): TranscriptionResult {
    if (!raw || typeof raw.text !== "string") {
      throw new TranscriptionError("Invalid response shape from Whisper API");
    }

    let words: TranscriptionWord[] = [];
    if (Array.isArray(raw.words) && raw.words.length > 0) {
      words = raw.words.map((w) => ({ word: w.word, start: w.start, end: w.end }));
    } else if (Array.isArray(raw.segments)) {
      for (const segment of raw.segments) {
        if (Array.isArray(segment.words)) {
          for (const w of segment.words) {
            words.push({ word: w.word, start: w.start, end: w.end });
          }
        }
      }
    }

    return { text: raw.text, words };
  }
}

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptionError";
  }
}
