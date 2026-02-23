import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sessionsApi } from "../services/api";
import { useSessionStore } from "../stores/sessionStore";
import { format } from "date-fns";
import type { SpeakerUpdate, HuddleSummary } from "../types";

const SPEAKER_COLORS = ["#4A90D9", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C"];

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = getText();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button className="btn-copy" onClick={handleCopy} title="Copy to clipboard">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function speakerToText(speaker: SpeakerUpdate): string {
  const name = speaker.name || speaker.speakerLabel;
  const lines: string[] = [`${name}:`];
  if (speaker.yesterday) lines.push(`  Yesterday: ${speaker.yesterday}`);
  if (speaker.today) lines.push(`  Today: ${speaker.today}`);
  if (speaker.blockers.length > 0) {
    lines.push(`  Blockers:`);
    speaker.blockers.forEach((b) => lines.push(`    - ${b}`));
  }
  if (speaker.actionItems.length > 0) {
    lines.push(`  Action Items:`);
    speaker.actionItems.forEach((a) => lines.push(`    - ${a}`));
  }
  return lines.join("\n");
}

function allSpeakersToText(speakers: SpeakerUpdate[]): string {
  return speakers.map(speakerToText).join("\n\n");
}

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
        <CopyButton getText={() => speakerToText(speaker)} />
        <span className="chevron">{expanded ? "\u25B2" : "\u25BC"}</span>
      </div>

      {expanded && (
        <div className="speaker-card-body">
          {speaker.yesterday && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">{"\u25C0"}</span>
                <span className="update-label">Yesterday</span>
              </div>
              <p className="update-text">{speaker.yesterday}</p>
            </div>
          )}

          {speaker.today && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">{"\u25B6"}</span>
                <span className="update-label today">Today</span>
              </div>
              <p className="update-text">{speaker.today}</p>
            </div>
          )}

          {speaker.blockers.length > 0 && (
            <div className="update-section">
              <div className="update-header">
                <span className="update-icon">{"\u26A0"}</span>
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
                <span className="update-icon">{"\u2713"}</span>
                <span className="update-label actions">Action Items</span>
              </div>
              {speaker.actionItems.map((a, i) => (
                <div key={i} className="action-row">
                  <span className="action-checkbox">{"\u2610"}</span>
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

function CombinedSummary({ speakers }: { speakers: SpeakerUpdate[] }) {
  return (
    <div className="combined-summary">
      <div className="combined-summary-header">
        <h3>Full Summary</h3>
        <CopyButton getText={() => allSpeakersToText(speakers)} />
      </div>
      <div className="combined-summary-body">
        {speakers.map((speaker, i) => {
          const name = speaker.name || speaker.speakerLabel;
          const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
          return (
            <div key={speaker.speakerLabel + i} className="combined-speaker-block">
              <div className="combined-speaker-name" style={{ color }}>
                {name}
              </div>
              <ul className="combined-list">
                {speaker.yesterday && (
                  <li>
                    <strong>Yesterday:</strong> {speaker.yesterday}
                  </li>
                )}
                {speaker.today && (
                  <li>
                    <strong>Today:</strong> {speaker.today}
                  </li>
                )}
                {speaker.blockers.map((b, j) => (
                  <li key={`b${j}`} className="combined-blocker">
                    <strong>Blocker:</strong> {b}
                  </li>
                ))}
                {speaker.actionItems.map((a, j) => (
                  <li key={`a${j}`} className="combined-action">
                    <strong>Action:</strong> {a}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
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
          <span className="stat-badge">{summary.speakers.length} speakers</span>
        </div>
      </div>

      {summary.speakers.map((speaker, i) => (
        <SpeakerCard key={speaker.speakerLabel + i} speaker={speaker} index={i} />
      ))}

      <CombinedSummary speakers={summary.speakers} />

      <button
        className="transcript-toggle"
        onClick={() => setShowTranscript(!showTranscript)}
      >
        {showTranscript ? "Hide Full Transcript" : "View Full Transcript"}{" "}
        {showTranscript ? "\u25B2" : "\u25BC"}
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
