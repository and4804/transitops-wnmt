import { useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { Role } from "../api/types";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/vehicles", label: "Vehicle Registry" },
  { to: "/trips", label: "Trips" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/drivers", label: "Drivers" },
  { to: "/fuel-expense", label: "Fuel & Expense" },
  { to: "/reports", label: "Reports" },
];

const ROLES: Role[] = ["FleetManager", "Dispatcher", "SafetyOfficer", "FinancialAnalyst"];

const emptyInvite = { name: "", email: "", role: "Dispatcher" as Role };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openInvite() {
    setInvite(emptyInvite);
    setInviteError(null);
    setInviteSuccess(null);
    setShowInvite(true);
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/invite", invite);
      setInviteSuccess(`${invite.email} can now sign in with Google using this email.`);
      setInvite(emptyInvite);
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to invite teammate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>TransitOps</h1>
        <div className="role-badge">{user?.name} · {user?.role}</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        {user?.role === "FleetManager" && (
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 8 }} onClick={openInvite}>
            + Invite teammate
          </button>
        )}
        <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <div className="main">
        <Outlet />
      </div>

      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Invite teammate</h3>
            <p style={{ marginTop: -8, marginBottom: 16, fontSize: 12, color: "var(--text-dim)" }}>
              Creates an account with no password — they sign in with Google using this exact email.
            </p>
            {inviteError && <div className="error-banner">{inviteError}</div>}
            {inviteSuccess && (
              <div className="card" style={{ marginBottom: 14, color: "var(--accent-2)" }}>
                {inviteSuccess}
              </div>
            )}
            <form onSubmit={submitInvite}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input
                    required
                    type="email"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Role</label>
                  <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="actions-row">
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? "Inviting..." : "Send invite"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowInvite(false)}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
