import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import type { Role } from "../api/types";
import GoogleSignInButton from "../components/GoogleSignInButton";
import AuthHero from "../components/AuthHero";

const ROLES: Role[] = ["FleetManager", "Dispatcher", "SafetyOfficer", "FinancialAnalyst"];

type Tab = "login" | "signup";

export default function Auth() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(location.pathname === "/signup" ? "signup" : "login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("raven.k@transitops.io");
  const [loginPassword, setLoginPassword] = useState("");

  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState<Role>("FleetManager");

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 423 ? err.message : "Invalid credentials");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(name, signupEmail, signupPassword, role);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <AuthHero />
        <div className="auth-hero-label">TransitOps // Auth</div>
        <div className="auth-hero-tagline">
          <h2>Move your fleet.</h2>
          <p>Sign in to dispatch trips, track vehicles, and keep drivers safe.</p>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <h1>TransitOps</h1>
          <p className="subtitle">Smart Transport Operations Platform</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={"auth-tab" + (tab === "login" ? " active" : "")}
              onClick={() => switchTab("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={"auth-tab" + (tab === "signup" ? " active" : "")}
              onClick={() => switchTab("signup")}
            >
              Create account
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <GoogleSignInButton onError={setError} />
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn auth-primary-btn" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Log in"}
              </button>
              <div className="auth-switch">
                New to TransitOps?{" "}
                <button type="button" className="auth-switch-link" onClick={() => switchTab("signup")}>
                  Create an account
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn auth-primary-btn" type="submit" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </button>
              <div className="auth-switch">
                Already have an account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => switchTab("login")}>
                  Log in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
