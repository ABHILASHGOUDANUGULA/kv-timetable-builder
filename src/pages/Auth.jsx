
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
            if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        // CHECK FOR EXISTING USER
        // If identities is empty, it means Supabase returned a fake user 
        // because this email is already registered.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("An account with this email already exists. Please log in instead.");
          setLoading(false);
          return;
        }

        if (data.session) {
          setMessage("Account created successfully!");
          onAuthSuccess?.(data.session);
        } else {
          setMessage(
            "Account created! Please check your email and click the confirmation link before logging in."
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("Login successful!");
        onAuthSuccess?.(data.session);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📚</div>

        <h1>School<span style={{ color: "#6254df" }}>TT</span></h1>

        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to save and continue your timetables."
            : "Create your account and save your work securely."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setMessage("");
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>

          <input
            id="auth-email"
            type="email"
            placeholder="teacher@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />

          <label htmlFor="auth-password">Password</label>

          <div className="auth-password-wrapper">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />

            <button
              type="button"
              className="auth-show-password"
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {message && <div className="auth-success">{message}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          You can also use the timetable builder without creating an account.
        </p>
      </div>
    </div>
  );
}
