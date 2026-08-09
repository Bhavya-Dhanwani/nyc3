import React, { useState, useEffect } from "react";
import api from "../lib/api.js";
import {
  X,
  Cloud,
  Key,
  User,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Sparkles,
  LogOut,
  Eye,
  EyeOff
} from "lucide-react";

export function SettingsModal({ isOpen, onClose, user, onLogout, onKeysUpdated }) {
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "drive" | "account"
  const [keys, setKeys] = useState(() => {
    try {
      const cached = localStorage.getItem("autoshorts_user_keys");
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      mistralKey: "",
      groqKey: "",
      openrouterKey: "",
      openaiKey: "",
      anthropicKey: "",
      geminiKey: "",
      deepseekKey: "",
      deepgramKey: ""
    };
  });
  const [showKeys, setShowKeys] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadKeys();
    }
  }, [isOpen]);

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/auth/keys");
      if (res.data?.data) {
        setKeys((prev) => {
          const merged = { ...prev, ...res.data.data };
          localStorage.setItem("autoshorts_user_keys", JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn("Failed to load user keys from server, using local storage:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      localStorage.setItem("autoshorts_user_keys", JSON.stringify(keys));
      await api.put("/api/auth/keys", keys);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onKeysUpdated) onKeysUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save keys to server (saved locally)");
    } finally {
      setSaving(false);
    }
  };

  const toggleShowKey = (field) => {
    setShowKeys((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleConnectDrive = () => {
    window.location.href = "/api/auth/google";
  };

  if (!isOpen) return null;

  const KEY_FIELDS = [
    { id: "groqKey", label: "Groq API Key (Ultra Fast Whisper & Llama)", placeholder: "gsk_..." },
    { id: "mistralKey", label: "Mistral API Key (Viral Moment Analysis)", placeholder: "..." },
    { id: "openaiKey", label: "OpenAI API Key (Whisper & GPT-4o)", placeholder: "sk-..." },
    { id: "deepgramKey", label: "Deepgram API Key (Nova-2 Speech)", placeholder: "..." },
    { id: "openrouterKey", label: "OpenRouter API Key", placeholder: "sk-or-..." },
    { id: "anthropicKey", label: "Anthropic Claude Key", placeholder: "sk-ant-..." },
    { id: "deepseekKey", label: "DeepSeek API Key", placeholder: "sk-..." },
    { id: "geminiKey", label: "Google Gemini Key", placeholder: "AIza..." }
  ];

  return (
    <div
      className="modal-overlay modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 999999
      }}
    >
      <div
        className="settings-modal modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "640px",
          background: "#11131a",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "14px",
          boxShadow: "0 30px 80px -10px rgba(0, 0, 0, 0.95), 0 0 40px -10px rgba(99, 102, 241, 0.2)",
          overflow: "hidden",
          color: "#f4f4f5",
          display: "flex",
          flexDirection: "column",
          position: "relative"
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={18} color="var(--as-accent)" />
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>AutoShorts Settings</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            <Key size={14} />
            <span>AI API Keys</span>
          </button>
          <button
            className={`modal-tab ${activeTab === "drive" ? "active" : ""}`}
            onClick={() => setActiveTab("drive")}
          >
            <Cloud size={14} />
            <span>Cloud Storage</span>
          </button>
          <button
            className={`modal-tab ${activeTab === "account" ? "active" : ""}`}
            onClick={() => setActiveTab("account")}
          >
            <User size={14} />
            <span>Account</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="alert alert-success">
              <CheckCircle2 size={15} />
              <span>API keys saved securely!</span>
            </div>
          )}

          {/* AI Tab */}
          {activeTab === "ai" && (
            <form onSubmit={handleSaveKeys} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "12px", color: "var(--as-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Configure your personal AI provider keys. Your keys are used for transcription, viral clip detection, and auto-captions.
              </p>

              <div className="form-grid-2">
                {KEY_FIELDS.map((field) => (
                  <div className="form-group" key={field.id}>
                    <label className="form-label">{field.label}</label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type={showKeys[field.id] ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={keys[field.id] || ""}
                        onChange={(e) => setKeys({ ...keys, [field.id]: e.target.value })}
                        className="form-input font-mono"
                        style={{ paddingRight: "36px", width: "100%" }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(field.id)}
                        style={{
                          position: "absolute",
                          right: "8px",
                          background: "transparent",
                          border: "none",
                          color: "#71717a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          padding: "4px"
                        }}
                      >
                        {showKeys[field.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid var(--as-card-border)" }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-gradient"
                >
                  {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  <span>{saving ? "Saving Keys..." : "Save API Keys"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Drive Tab */}
          {activeTab === "drive" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "12px", color: "var(--as-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Connect your Google Drive account to automatically store source videos and export rendered 9:16 Shorts directly to your cloud.
              </p>

              <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Cloud size={24} color="#3b82f6" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>Google Drive</h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--as-text-secondary)" }}>
                      {user?.googleAccessToken ? "Connected and active" : "Not connected"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectDrive}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                >
                  <ExternalLink size={13} />
                  <span>{user?.googleAccessToken ? "Reconnect Account" : "Connect Google Drive"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "var(--as-text-secondary)" }}>Account Name</span>
                  <strong style={{ fontSize: "12px" }}>{user?.name || "User"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "var(--as-text-secondary)" }}>Email Address</span>
                  <strong style={{ fontSize: "12px" }}>{user?.email || "Unknown"}</strong>
                </div>
              </div>

              {onLogout && (
                <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: "8px" }}>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="btn-secondary"
                    style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
