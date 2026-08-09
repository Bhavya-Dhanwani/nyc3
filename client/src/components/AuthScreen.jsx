import React, { useState, useEffect } from "react";
import api, { setAccessToken } from "../lib/api.js";
import { Film, CheckCircle2 } from "lucide-react";

export function AuthScreen({ onAuthSuccess }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
      api.get("/api/auth/me").then((res) => {
        if (res.data?.data) onAuthSuccess(res.data.data);
      }).catch(() => {});
    }
    if (params.get("googleError")) {
      setError("Google authentication was canceled or failed.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="auth-screen-wrapper">
      <div className="auth-card-container">
        {/* Logo & Brand Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <Film size={26} />
          </div>
          <h1 className="auth-title">AutoShorts Studio</h1>
          <p className="auth-subtitle">AI Video Editor & Multi-Clip Automation Platform</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner">
            <span>{error}</span>
          </div>
        )}

        {/* Google OAuth One-Click Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="btn-secondary"
          style={{
            width: "100%",
            height: "48px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid var(--as-input-border)",
            borderRadius: "var(--as-radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginTop: "16px",
            marginBottom: "20px"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continue with Google & Drive</span>
        </button>

        {/* Feature Highlights */}
        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <CheckCircle2 size={16} />
            <span>Full Multi-Track Timeline Video Editor</span>
          </div>
          <div className="auth-feature-item">
            <CheckCircle2 size={16} />
            <span>Automatic AI Multi-Clip Detection & 9:16 Shorts</span>
          </div>
          <div className="auth-feature-item">
            <CheckCircle2 size={16} />
            <span>Direct Google Drive Single-Folder Synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;

