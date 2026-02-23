import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="layout">
      <header className="navbar">
        <div className="navbar-brand" onClick={() => navigate("/")}>
          <div className="navbar-logo">🎙</div>
          <span className="navbar-title">HuddleSync</span>
        </div>
        <div className="navbar-right">
          <span className="navbar-user">{user?.displayName}</span>
          <button className="btn-text" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
