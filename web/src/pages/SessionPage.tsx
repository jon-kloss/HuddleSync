import { useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSessionStore } from "../stores/sessionStore";

const NUM_BARS = 24;
const SPEAKER_COLORS = ["#4A90D9", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C"];

function WaveformVisualizer({ isActive }: { isActive: boolean }) {
  const barsRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!barsRef.current) return;
    const bars = barsRef.current.children;

    if (!isActive) {
      for (let i = 0; i < bars.length; i++) {
        (bars[i] as HTMLElement).style.height = "8px";
      }
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = () => {
      for (let i = 0; i < bars.length; i++) {
        const height = 8 + Math.random() * 52;
        (bars[i] as HTMLElement).style.height = `${height}px`;
      }
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(() => {
          animationRef.current = requestAnimationFrame(animate);
        }, 120);
      });
    };

    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive]);

  return (
    <div className="waveform" ref={barsRef}>
      {Array.from({ length: NUM_BARS }, (_, i) => (
        <div
          key={i}
          className={`waveform-bar ${isActive ? "active" : ""}`}
        />
      ))}
    </div>
  );
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const {
    isRecording, isPaused, duration, transcriptSegments, currentSpeaker,
    pauseSession, resumeSession, endSession,
  } = useSessionStore();

  const speakerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 0;
    for (const seg of transcriptSegments) {
      if (!map[seg.speakerLabel]) {
        map[seg.speakerLabel] = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
        idx++;
      }
    }
    if (currentSpeaker && !map[currentSpeaker.speakerLabel]) {
      map[currentSpeaker.speakerLabel] = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
    }
    return map;
  }, [transcriptSegments, currentSpeaker]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptSegments.length]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndHuddle = async () => {
    if (!window.confirm("Are you sure you want to end this huddle?")) return;
    await endSession();
    navigate(`/summary/${id}`, { replace: true });
  };

  return (
    <div className="session-page">
      <div className="session-top-bar">
        <div className="timer-container">
          <div className={`recording-dot ${isPaused ? "paused" : "recording"}`} />
          <span className="timer">{formatTime(duration)}</span>
        </div>
        {currentSpeaker && (
          <span
            className="speaker-badge"
            style={{ backgroundColor: speakerColorMap[currentSpeaker.speakerLabel] }}
          >
            {currentSpeaker.matchedUserName || currentSpeaker.speakerLabel}
          </span>
        )}
      </div>

      <div className="waveform-section">
        <WaveformVisualizer isActive={isRecording && !isPaused} />
        <span className="waveform-label">
          {isPaused ? "Paused" : isRecording ? "Listening..." : "Idle"}
        </span>
      </div>

      <div className="transcript-section">
        <h3>Live Transcript</h3>
        <div className="transcript-scroll">
          {transcriptSegments.length === 0 ? (
            <p className="transcript-placeholder">
              Transcript will appear here as people speak...
            </p>
          ) : (
            transcriptSegments.map((seg, i) => (
              <div key={i} className="transcript-entry">
                <div
                  className="speaker-dot"
                  style={{ backgroundColor: speakerColorMap[seg.speakerLabel] }}
                />
                <div className="transcript-text-container">
                  <span
                    className="transcript-speaker"
                    style={{ color: speakerColorMap[seg.speakerLabel] }}
                  >
                    {seg.userName || seg.speakerLabel}
                  </span>
                  <p className="transcript-text">{seg.text}</p>
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="session-controls">
        <button
          className="btn-pause"
          onClick={isPaused ? resumeSession : pauseSession}
        >
          {isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button className="btn-end" onClick={handleEndHuddle}>
          ⏹ End Huddle
        </button>
      </div>
    </div>
  );
}
