export interface User {
  id: string;
  displayName: string;
  email: string;
  role: "ADMIN" | "MEMBER" | "GUEST";
  teamId: string | null;
}

export interface Team {
  team_id: string;
  name: string;
  created_at: string;
  owner_user_id: string;
  members?: User[];
}

export interface HuddleSession {
  session_id: string;
  team_id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  status: "ACTIVE" | "PROCESSING" | "COMPLETED" | "FAILED";
  team?: { team_id: string; name: string };
  starter?: { display_name: string };
  summaries?: Summary[];
}

export interface TranscriptSegment {
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  userName?: string;
}

export interface SpeakerDetection {
  speakerLabel: string;
  confidence: number;
  matchedUserId?: string;
  matchedUserName?: string;
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

export interface Summary {
  summary_id: string;
  session_id: string;
  generated_at: string;
  content: HuddleSummary;
  is_final: boolean;
  speaker_summaries?: SpeakerSummaryRecord[];
}

export interface HuddleSummary {
  speakers: SpeakerUpdate[];
  meetingDate?: string;
  teamName?: string;
}

export interface SpeakerSummaryRecord {
  speaker_summary_id: string;
  summary_id: string;
  user_id: string | null;
  speaker_label: string;
  yesterday: string;
  today: string;
  blockers: string[];
  action_items: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface PaginatedResponse<T> {
  sessions: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
