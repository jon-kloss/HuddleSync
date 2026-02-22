import Anthropic from "@anthropic-ai/sdk";

export interface SpeakerTranscript {
  speakerLabel: string;
  userName?: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface SpeakerUpdate {
  speakerLabel: string;
  name?: string;
  yesterday: string;
  today: string;
  blockers: string[];
  actionItems: string[];
  confidence: number;
}

export interface HuddleSummary {
  speakers: SpeakerUpdate[];
  meetingDate?: string;
  teamName?: string;
  durationMs?: number;
}

export class SummarizationService {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateIncrementalSummary(
    transcript: SpeakerTranscript[],
    teamName: string,
    participants: string[],
  ): Promise<HuddleSummary> {
    const transcriptText = this.formatTranscript(transcript);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are HuddleSync, an AI assistant that analyzes team standup/huddle meeting transcripts. Extract each speaker's update and organize it into structured summaries.

You must respond with valid JSON matching this schema:
{
  "speakers": [
    {
      "speakerLabel": "string (the speaker identifier)",
      "name": "string or null (matched name if known)",
      "yesterday": "string (what they did yesterday/previously)",
      "today": "string (what they plan to do today)",
      "blockers": ["array of blocker strings"],
      "actionItems": ["array of action item strings"],
      "confidence": "number 0-1 (confidence in speaker attribution)"
    }
  ]
}

If a speaker hasn't mentioned a category (yesterday, today, blockers), use an empty string or empty array. This is an incremental summary — the meeting may still be in progress.`,
      messages: [
        {
          role: "user",
          content: `Team: ${teamName}\nParticipants: ${participants.join(", ")}\n\nTranscript so far:\n${transcriptText}\n\nProvide the incremental summary as JSON.`,
        },
      ],
    });

    return this.parseResponse(response);
  }

  async generateFinalSummary(
    transcript: SpeakerTranscript[],
    teamName: string,
    participants: string[],
    date: string,
  ): Promise<HuddleSummary> {
    const transcriptText = this.formatTranscript(transcript);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are HuddleSync, an AI assistant that analyzes team standup/huddle meeting transcripts. This is the FINAL summary for a completed meeting. Extract each speaker's complete update and organize it into structured summaries.

You must respond with valid JSON matching this schema:
{
  "speakers": [
    {
      "speakerLabel": "string (the speaker identifier)",
      "name": "string or null (matched name if known)",
      "yesterday": "string (comprehensive summary of what they did yesterday/previously)",
      "today": "string (comprehensive summary of what they plan to do today)",
      "blockers": ["array of blocker strings"],
      "actionItems": ["array of action item strings"],
      "confidence": "number 0-1 (confidence in speaker attribution)"
    }
  ]
}

Be thorough — this is the final record. Flag any segments where speaker attribution is uncertain with a lower confidence score. If speakers reference each other, note cross-references in action items.`,
      messages: [
        {
          role: "user",
          content: `Team: ${teamName}\nDate: ${date}\nParticipants: ${participants.join(", ")}\n\nComplete meeting transcript:\n${transcriptText}\n\nProvide the final comprehensive summary as JSON.`,
        },
      ],
    });

    const summary = this.parseResponse(response);
    summary.meetingDate = date;
    summary.teamName = teamName;
    return summary;
  }

  private formatTranscript(transcript: SpeakerTranscript[]): string {
    return transcript
      .map((seg) => {
        const speaker = seg.userName || seg.speakerLabel;
        const timeStart = this.formatTime(seg.startMs);
        const timeEnd = this.formatTime(seg.endMs);
        return `[${timeStart}-${timeEnd}] ${speaker}: ${seg.text}`;
      })
      .join("\n");
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  private parseResponse(response: Anthropic.Message): HuddleSummary {
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new SummarizationError("No text response from Claude");
    }

    try {
      let jsonText = textBlock.text.trim();
      // Handle markdown code blocks
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      const parsed = JSON.parse(jsonText);
      return parsed as HuddleSummary;
    } catch {
      throw new SummarizationError(`Failed to parse Claude response as JSON: ${textBlock.text.substring(0, 200)}`);
    }
  }
}

export class SummarizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummarizationError";
  }
}
