import { DiarizationService, DiarizationResult } from "./diarization.js";
import { TranscriptionService, TranscriptionResult, TranscriptionWord } from "./transcription.js";
import { SummarizationService, SpeakerTranscript, HuddleSummary } from "./summarization.js";

export interface ProcessedChunk {
  segments: SpeakerTranscript[];
  rawTranscription: TranscriptionResult;
  rawDiarization: DiarizationResult;
}

export class PipelineOrchestrator {
  constructor(
    private readonly diarization: DiarizationService,
    private readonly transcription: TranscriptionService,
    private readonly summarization: SummarizationService,
  ) {}

  async processAudioChunk(audioBuffer: Buffer, sessionId: string): Promise<ProcessedChunk> {
    // Run diarization and transcription in parallel
    const [diarizationResult, transcriptionResult] = await Promise.all([
      this.diarization.processChunk(audioBuffer, sessionId).catch((err) => {
        console.error("[Orchestrator] Diarization failed, continuing with ASR only:", err.message);
        return { segments: [] } as DiarizationResult;
      }),
      this.transcription.transcribe(audioBuffer),
    ]);

    const segments = this.mergeTranscriptWithDiarization(transcriptionResult, diarizationResult);

    return {
      segments,
      rawTranscription: transcriptionResult,
      rawDiarization: diarizationResult,
    };
  }

  mergeTranscriptWithDiarization(
    transcription: TranscriptionResult,
    diarization: DiarizationResult,
  ): SpeakerTranscript[] {
    if (diarization.segments.length === 0) {
      // No diarization data — attribute everything to "Unknown Speaker"
      return [
        {
          speakerLabel: "SPEAKER_UNKNOWN",
          text: transcription.text,
          startMs: transcription.words.length > 0 ? Math.floor(transcription.words[0].start * 1000) : 0,
          endMs:
            transcription.words.length > 0
              ? Math.floor(transcription.words[transcription.words.length - 1].end * 1000)
              : 0,
        },
      ];
    }

    // For each word, find the overlapping diarization segment
    const labeledWords: Array<{ word: TranscriptionWord; speakerLabel: string }> = [];

    for (const word of transcription.words) {
      const wordMidMs = ((word.start + word.end) / 2) * 1000;
      let bestSegment = diarization.segments[0];
      let bestDistance = Infinity;

      for (const seg of diarization.segments) {
        if (wordMidMs >= seg.startMs && wordMidMs <= seg.endMs) {
          bestSegment = seg;
          bestDistance = 0;
          break;
        }
        const distance = Math.min(
          Math.abs(wordMidMs - seg.startMs),
          Math.abs(wordMidMs - seg.endMs),
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSegment = seg;
        }
      }

      labeledWords.push({ word, speakerLabel: bestSegment.speakerLabel });
    }

    // Group consecutive words with the same speaker
    const segments: SpeakerTranscript[] = [];
    let currentGroup: typeof labeledWords = [];
    let currentSpeaker = "";

    for (const item of labeledWords) {
      if (item.speakerLabel !== currentSpeaker) {
        if (currentGroup.length > 0) {
          segments.push(this.buildSegment(currentSpeaker, currentGroup));
        }
        currentSpeaker = item.speakerLabel;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    }

    if (currentGroup.length > 0) {
      segments.push(this.buildSegment(currentSpeaker, currentGroup));
    }

    return segments;
  }

  async generateSummary(
    sessionId: string,
    transcript: SpeakerTranscript[],
    isIncremental: boolean,
    teamName: string,
    participants: string[],
  ): Promise<HuddleSummary> {
    if (isIncremental) {
      return this.summarization.generateIncrementalSummary(transcript, teamName, participants);
    }
    const date = new Date().toISOString().split("T")[0];
    return this.summarization.generateFinalSummary(transcript, teamName, participants, date);
  }

  private buildSegment(
    speakerLabel: string,
    words: Array<{ word: TranscriptionWord; speakerLabel: string }>,
  ): SpeakerTranscript {
    return {
      speakerLabel,
      text: words.map((w) => w.word.word).join(" "),
      startMs: Math.floor(words[0].word.start * 1000),
      endMs: Math.floor(words[words.length - 1].word.end * 1000),
    };
  }
}
