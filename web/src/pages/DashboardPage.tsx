import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { teamsApi } from "../services/api";
import { format } from "date-fns";
import type { HuddleSession } from "../types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, loadStoredAuth } = useAuthStore();
  const { sessions, loadSessions, startSession } = useSessionStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  useEffect(() => {
    if (user?.teamId) {
      setLoading(true);
      loadSessions(user.teamId).finally(() => setLoading(false));
    }
  }, [user?.teamId]);

  const handleStartHuddle = async () => {
    if (!user?.teamId || !accessToken) return;
    setStarting(true);
    try {
      const sessionId = await startSession(user.teamId, accessToken);
      navigate(`/session/${sessionId}`);
    } catch (err) {
      console.error("Failed to start huddle:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreatingTeam(true);
    try {
      await teamsApi.create(teamName.trim());
      await loadStoredAuth();
      setTeamName("");
    } catch (err) {
      console.error("Failed to create team:", err);
    } finally {
      setCreatingTeam(false);
    }
  };

  const formatDuration = (session: HuddleSession) => {
    if (!session.ended_at) return "In progress";
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const mins = Math.round((end - start) / 60000);
    return `${mins} min`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>HuddleSync</h2>
        <p className="subtitle">{user?.teamId ? "Your Team" : "No team yet"}</p>
      </div>

      {!user?.teamId ? (
        <div className="create-team-section">
          <p>Create or join a team to start a huddle</p>
          <form onSubmit={handleCreateTeam} className="create-team-form">
            <input
              type="text"
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={creatingTeam}>
              {creatingTeam ? "Creating..." : "Create Team"}
            </button>
          </form>
        </div>
      ) : (
        <div className="start-section">
          <button
            className="start-button"
            onClick={handleStartHuddle}
            disabled={starting}
          >
            {starting ? (
              <div className="spinner" />
            ) : (
              <>
                <span className="start-icon">🎙</span>
                <span>Start Huddle</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="recent-section">
        <h3>Recent Huddles</h3>
        {loading ? (
          <div className="loading-inline">
            <div className="spinner" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No huddles yet</p>
            <p className="empty-subtitle">Start your first huddle above</p>
          </div>
        ) : (
          <div className="session-list">
            {sessions.slice(0, 10).map((session) => (
              <div
                key={session.session_id}
                className="session-card"
                onClick={() => navigate(`/summary/${session.session_id}`)}
              >
                <div className="session-card-header">
                  <span className="session-date">
                    {format(new Date(session.started_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  <span className={`status-badge status-${session.status.toLowerCase()}`}>
                    {session.status}
                  </span>
                </div>
                <div className="session-card-body">
                  <span className="session-meta">⏱ {formatDuration(session)}</span>
                  <span className="session-meta">
                    👤 {session.starter?.display_name || "Unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
