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
  EyeOff,
  Plus,
  Trash2
} from "lucide-react";

// Helper: normalize a value to an array of non-empty strings
function toKeyArray(val) {
  if (Array.isArray(val)) return val.map(v => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}

// Helper: normalize a full keys object (from server or localStorage) to array format
function normalizeKeysToArrays(raw) {
  const result = {};
  for (const field of KEY_FIELDS) {
    // Try plural (new format) first, then singular (old format)
    const pluralVal = raw[field.id];
    const singularVal = raw[field.legacyId];
    if (pluralVal !== undefined) {
      result[field.id] = toKeyArray(pluralVal);
    } else if (singularVal !== undefined) {
      result[field.id] = toKeyArray(singularVal);
    } else {
      result[field.id] = [];
    }
  }
  return result;
}

const KEY_FIELDS = [
  { id: "groqKeys", legacyId: "groqKey", label: "Groq API Key (Ultra Fast Whisper & Llama)", placeholder: "gsk_..." },
  { id: "mistralKeys", legacyId: "mistralKey", label: "Mistral API Key (Viral Moment Analysis)", placeholder: "..." },
  { id: "openaiKeys", legacyId: "openaiKey", label: "OpenAI API Key (Whisper & GPT-4o)", placeholder: "sk-..." },
  { id: "deepgramKeys", legacyId: "deepgramKey", label: "Deepgram API Key (Nova-2 Speech)", placeholder: "..." },
  { id: "openrouterKeys", legacyId: "openrouterKey", label: "OpenRouter API Key", placeholder: "sk-or-..." },
  { id: "anthropicKeys", legacyId: "anthropicKey", label: "Anthropic Claude Key", placeholder: "sk-ant-..." },
  { id: "deepseekKeys", legacyId: "deepseekKey", label: "DeepSeek API Key", placeholder: "sk-..." },
  { id: "geminiKeys", legacyId: "geminiKey", label: "Google Gemini Key", placeholder: "AIza..." }
];

export function SettingsModal({ isOpen, onClose, user, onLogout, onKeysUpdated }) {
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "drive" | "account"
  const [keys, setKeys] = useState(() => {
    try {
      const cached = localStorage.getItem("autoshorts_user_keys");
      if (cached) return normalizeKeysToArrays(JSON.parse(cached));
    } catch {}
    const empty = {};
    for (const field of KEY_FIELDS) empty[field.id] = [];
    return empty;
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
          const merged = normalizeKeysToArrays({ ...prev, ...res.data.data });
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
      // Clean up: filter empty strings from arrays before saving
      const cleaned = {};
      for (const field of KEY_FIELDS) {
        cleaned[field.id] = (keys[field.id] || []).map(k => k.trim()).filter(Boolean);
      }
      localStorage.setItem("autoshorts_user_keys", JSON.stringify(cleaned));
      await api.put("/api/auth/keys", cleaned);
      setKeys(cleaned);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onKeysUpdated) onKeysUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save keys to server (saved locally)");
    } finally {
      setSaving(false);
    }
  };

  const toggleShowKey = (fieldId, index) => {
    const k = `${fieldId}_${index}`;
    setShowKeys((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const handleKeyChange = (fieldId, index, value) => {
    setKeys((prev) => {
      const arr = [...(prev[fieldId] || [])];
      arr[index] = value;
      return { ...prev, [fieldId]: arr };
    });
  };

  const addKey = (fieldId) => {
    setKeys((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ""]
    }));
  };

  const removeKey = (fieldId, index) => {
    setKeys((prev) => {
      const arr = [...(prev[fieldId] || [])];
      arr.splice(index, 1);
      return { ...prev, [fieldId]: arr };
    });
    // Clean up show state
    setShowKeys((prev) => {
      const next = { ...prev };
      delete next[`${fieldId}_${index}`];
      return next;
    });
  };

  const handleConnectDrive = () => {
    window.location.href = "/api/auth/google";
  };

  if (!isOpen) return null;

  const totalKeys = KEY_FIELDS.reduce((sum, f) => sum + (keys[f.id] || []).filter(k => k.trim()).length, 0);

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
                Configure your personal AI provider keys. Add multiple keys per provider for automatic failover when rate limits (429) are hit.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {KEY_FIELDS.map((field) => {
                  const fieldKeys = keys[field.id] || [];
                  const keyCount = fieldKeys.filter(k => k.trim()).length;

                  return (
                    <div key={field.id} style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "12px",
                    }}>
                      {/* Provider header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: fieldKeys.length > 0 ? "8px" : 0 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: "11.5px", fontWeight: 500 }}>
                          {field.label}
                        </label>
                        {keyCount > 0 && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "8px",
                            background: keyCount > 1 ? "rgba(34, 197, 94, 0.15)" : "rgba(99, 102, 241, 0.15)",
                            color: keyCount > 1 ? "#4ade80" : "#818cf8",
                            letterSpacing: "0.3px"
                          }}>
                            {keyCount} key{keyCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Key inputs */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {fieldKeys.map((keyVal, idx) => {
                          const showId = `${field.id}_${idx}`;
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                                <input
                                  type={showKeys[showId] ? "text" : "password"}
                                  placeholder={field.placeholder}
                                  value={keyVal}
                                  onChange={(e) => handleKeyChange(field.id, idx, e.target.value)}
                                  className="form-input font-mono"
                                  style={{ paddingRight: "36px", width: "100%", fontSize: "12px" }}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleShowKey(field.id, idx)}
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
                                  {showKeys[showId] ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeKey(field.id, idx)}
                                title="Remove this key"
                                style={{
                                  background: "transparent",
                                  border: "1px solid rgba(239, 68, 68, 0.25)",
                                  borderRadius: "6px",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "6px",
                                  opacity: 0.7,
                                  transition: "opacity 0.15s ease"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add key button */}
                      <button
                        type="button"
                        onClick={() => addKey(field.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "transparent",
                          border: "1px dashed rgba(255, 255, 255, 0.12)",
                          borderRadius: "7px",
                          color: "#71717a",
                          cursor: "pointer",
                          padding: "5px 10px",
                          fontSize: "11px",
                          marginTop: fieldKeys.length > 0 ? "6px" : 0,
                          transition: "color 0.15s ease, border-color 0.15s ease",
                          width: "100%",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#a1a1aa";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#71717a";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                        }}
                      >
                        <Plus size={12} />
                        <span>{fieldKeys.length === 0 ? "Add API key" : "Add another key"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {totalKeys > 1 && (
                <p style={{ fontSize: "11px", color: "#4ade80", margin: 0, lineHeight: 1.5, display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={12} />
                  Auto-failover active — {totalKeys} keys configured across providers. If one key hits a rate limit, the next key is tried automatically.
                </p>
              )}

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
