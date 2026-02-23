import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sessionsApi } from "../services/api";
import { useSessionStore } from "../stores/sessionStore";
import { format } from "date-fns";
import type { SpeakerUpdate, HuddleSummary } from "../types";

const SPEAKER_COLORS = ["#4A90D9", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C"];

function SpeakerCard({ speaker, index }: { speaker: SpeakerUpdate; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const color = SPEAKER_COLORS[index % SPEAKER_COLORS.length];

  const initials = (speaker.name || speaker.speakerLabel)
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const confidenceColor =
    speaker.confidence >= 0.8 ? "#27AE60" : speaker.confidence >= 0.5 ? "#F39C12" : "#E74C3C";

  return (
    <div className="speaker-card">
      <div className="speaker-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="speaker-avatar" style={{ backgroundColor: color }}>
          {initials}
        </div>
        <div className="speaker-header-info">
          <span className="speaker-name">{speaker.name || speaker.speakerLabel}</span>
          <span className="confidence-row">
            <span className="confidence-dot" style={{ backgroundColor: confidenceColor }} />
            {Math.round(speaker.confidence * 100)}% confidence
          </span>
        </div>
        <span className="chevron">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="speaker-card-body">
          {speaker.yesterday && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">◀</span>
                <span className="update-label">Yesterday</span>
              </div>
              <p className="update-text">{speaker.yesterday}</p>
            </div>
          )}

          {speaker.today && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">▶</span>
                <span className="update-label today">Today</span>
              </div>
              <p className="update-text">{speaker.today}</p>
            </div>
          )}

          {speaker.blockers.length > 0 && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">⚠</span>
                <span className="update-label blockers">Blockers</span>
              </div>
              {speaker.blockers.map((b, i) => (
                <div key={i} className="blocker-row">
                  <span className="blocker-dot" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {speaker.actionItems.length > 0 && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">✓</span>
                <span className="update-label actions">Action Items</span>
              </div>
              {speaker.actionItems.map((a, i) => (
                <div key={i} className="action-row">
                  <span className="action-checkbox">☐</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { currentSummary } = useSessionStore();
  const [summary, setSummary] = useState<HuddleSummary | null>(currentSummary);
  const [loading, setLoading] = useState(!currentSummary);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!currentSummary && id) {
      loadSummary();
    }
  }, [id]);

  const loadSummary = async () => {
    try {
      const session = await sessionsApi.get(id!);
      setSessionDate(session.started_at);
      if (session.summaries && session.summaries.length > 0) {
        setSummary(session.summaries[0].content as unknown as HuddleSummary);
      }
    } catch (err) {
      console.error("Failed to load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="centered-state">
        <div className="spinner" />
        <p>Loading summary...</p>
      </div>
    );
  }

  if (!summary || !summary.speakers || summary.speakers.length === 0) {
    return (
      <div className="centered-state">
        <p className="empty-title">No Summary Available</p>
        <p className="empty-subtitle">The summary will be generated when the huddle ends.</p>
      </div>
    );
  }

  return (
    <div className="summary-page">
      <div className="meeting-header">
        <h2>{summary.teamName || "Huddle"} Summary</h2>
        {sessionDate && (
          <p className="meeting-date">
            {format(new Date(sessionDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </p>
        )}
        <div className="meeting-stats">
          <span className="stat-badge">👥 {summary.speakers.length} speakers</span>
        </div>
      </div>

      {summary.speakers.map((speaker, i) => (
        <SpeakerCard key={speaker.speakerLabel + i} speaker={speaker} index={i} />
      ))}

      <button
        className="transcript-toggle"
        onClick={() => setShowTranscript(!showTranscript)}
      >
        📄 {showTranscript ? "Hide Full Transcript" : "View Full Transcript"}{" "}
        {showTranscript ? "▲" : "▼"}
      </button>

      {showTranscript && (
        <div className="transcript-container">
          <p className="transcript-placeholder">
            Full transcript will be available after the session is processed.
          </p>
        </div>
      )}
    </div>
  );
}
