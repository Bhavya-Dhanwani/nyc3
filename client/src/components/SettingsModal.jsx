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
    <div className="modal-overlay modal-backdrop" onClick={onClose}>
      <div className="settings-modal modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Left Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={18} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>Katitor Settings</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--as-text-muted)" }}>Workspace Preferences</p>
              </div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button className={`settings-sidebar-item ${activeTab === "ai" ? "active" : ""}`} onClick={() => setActiveTab("ai")}>
              <Key size={16} /> <span>AI Provider Keys</span>
              {totalKeys > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: activeTab === "ai" ? "#000000" : "rgba(255, 255, 255, 0.15)", color: activeTab === "ai" ? "#ffffff" : "#a3a3a3", fontWeight: 700 }}>
                  {totalKeys}
                </span>
              )}
            </button>
            
            <button className={`settings-sidebar-item ${activeTab === "drive" ? "active" : ""}`} onClick={() => setActiveTab("drive")}>
              <Cloud size={16} /> <span>Cloud Storage</span>
              {user?.googleAccessToken && (
                <span style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              )}
            </button>

            <button className={`settings-sidebar-item ${activeTab === "account" ? "active" : ""}`} onClick={() => setActiveTab("account")}>
              <User size={16} /> <span>Account</span>
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="settings-content">
          <button className="btn-icon settings-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
          
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
              {activeTab === "ai" ? "AI Provider Keys" : activeTab === "drive" ? "Cloud Storage" : "Account Settings"}
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--as-text-muted)" }}>
              {activeTab === "ai" ? "Configure your API keys for various AI models." : activeTab === "drive" ? "Manage your Google Drive integration." : "Manage your user profile and session."}
            </p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "20px" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="alert alert-success" style={{ marginBottom: "20px" }}>
              <CheckCircle2 size={16} />
              <span>API keys saved securely!</span>
            </div>
          )}

          {/* AI Tab */}
          {activeTab === "ai" && (
            <form onSubmit={handleSaveKeys} style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "modalPopIn 0.25s ease-out" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "14px 18px" }}>
                <Sparkles size={18} color="#ffffff" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: "12px", color: "var(--as-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Add multiple API keys per provider for automatic failover when rate limits (429) occur. Keys are stored securely.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {KEY_FIELDS.map((field) => {
                  const fieldKeys = keys[field.id] || [];
                  const keyCount = fieldKeys.filter(k => k.trim()).length;

                  return (
                    <div key={field.id} style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "16px",
                      padding: "18px 20px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    }}>
                      {/* Provider header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: fieldKeys.length > 0 ? "14px" : 0 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                          {field.label}
                        </label>
                        {keyCount > 0 && (
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "999px",
                            background: "rgba(255, 255, 255, 0.12)",
                            color: "#ffffff",
                            border: "1px solid rgba(255, 255, 255, 0.2)"
                          }}>
                            {keyCount} active key{keyCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Key inputs */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {fieldKeys.map((keyVal, idx) => {
                          const showId = `${field.id}_${idx}`;
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", animation: "modalPopIn 0.2s ease-out" }}>
                              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                                <input
                                  type={showKeys[showId] ? "text" : "password"}
                                  placeholder={field.placeholder}
                                  value={keyVal}
                                  onChange={(e) => handleKeyChange(field.id, idx, e.target.value)}
                                  className="form-input font-mono"
                                  style={{ paddingRight: "44px", width: "100%", fontSize: "13px", height: "42px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}
                                  onFocus={(e) => e.target.style.borderColor = "#ffffff"}
                                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleShowKey(field.id, idx)}
                                  style={{
                                    position: "absolute",
                                    right: "12px",
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--as-text-muted)",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px",
                                    transition: "color 0.2s"
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--as-text-muted)"}
                                >
                                  {showKeys[showId] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeKey(field.id, idx)}
                                title="Remove key"
                                style={{
                                  background: "rgba(244, 63, 94, 0.05)",
                                  border: "1px solid rgba(244, 63, 94, 0.15)",
                                  borderRadius: "10px",
                                  color: "#f43f5e",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  height: "42px",
                                  width: "42px",
                                  transition: "all 0.2s ease"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "rgba(244, 63, 94, 0.15)";
                                  e.currentTarget.style.transform = "scale(1.05)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "rgba(244, 63, 94, 0.05)";
                                  e.currentTarget.style.transform = "scale(1)";
                                }}
                              >
                                <Trash2 size={16} />
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
                          gap: "8px",
                          background: "rgba(255,255,255,0.015)",
                          border: "1px dashed rgba(255, 255, 255, 0.12)",
                          borderRadius: "10px",
                          color: "var(--as-text-muted)",
                          cursor: "pointer",
                          padding: "10px 16px",
                          fontSize: "13px",
                          fontWeight: 600,
                          marginTop: fieldKeys.length > 0 ? "12px" : 0,
                          transition: "all 0.2s ease",
                          width: "100%",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--as-text-muted)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.015)";
                        }}
                      >
                        <Plus size={15} />
                        <span>{fieldKeys.length === 0 ? "Add API key" : "Add another fallback key"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {totalKeys > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(52, 211, 153, 0.08)", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                  <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: "13px", color: "#34d399", margin: 0, fontWeight: 500 }}>
                    Auto-failover is active — {totalKeys} keys configured across providers.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "20px", paddingBottom: "10px", position: "sticky", bottom: "-32px", background: "linear-gradient(0deg, #121212 60%, transparent)", zIndex: 10 }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-gradient"
                  style={{ padding: "12px 24px", fontSize: "13px", borderRadius: "9999px", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />}
                  <span>{saving ? "Saving Configuration..." : "Save API Keys"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Drive Tab */}
          {activeTab === "drive" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "modalPopIn 0.25s ease-out" }}>
              <div style={{ padding: "28px 24px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "24px", position: "relative", overflow: "hidden" }}>
                {user?.googleAccessToken && (
                  <div style={{ position: "absolute", top: 0, right: 0, width: "150px", height: "150px", background: "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
                )}
                
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Cloud size={28} color="#34d399" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>Google Drive Sync</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: user?.googleAccessToken ? "#34d399" : "var(--as-text-muted)", fontWeight: 500 }}>
                        {user?.googleAccessToken ? "● Connected and Active" : "Not connected"}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ zIndex: 1 }}>
                  <p style={{ fontSize: "14px", color: "var(--as-text-secondary)", margin: 0, lineHeight: 1.6 }}>
                    Connect your Google Drive account to seamlessly back up source videos and automatically sync your rendered 9:16 Shorts to the cloud.
                  </p>
                </div>

                <div style={{ zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleConnectDrive}
                    className={user?.googleAccessToken ? "btn-secondary" : "btn-primary-gradient"}
                    style={{ padding: "10px 20px", borderRadius: "10px" }}
                  >
                    <ExternalLink size={16} />
                    <span>{user?.googleAccessToken ? "Reconnect Account" : "Connect Google Drive"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "modalPopIn 0.25s ease-out" }}>
              <div style={{ padding: "24px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "var(--as-text-secondary)", fontWeight: 500 }}>Profile Name</span>
                  <strong style={{ fontSize: "14px", color: "#ffffff", fontWeight: 700 }}>{user?.name || "User"}</strong>
                </div>
                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "var(--as-text-secondary)", fontWeight: 500 }}>Email Address</span>
                  <strong style={{ fontSize: "14px", color: "#ffffff", fontWeight: 700 }}>{user?.email || "Unknown"}</strong>
                </div>
              </div>

              {onLogout && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(244, 63, 94, 0.08)",
                      border: "1px solid rgba(244, 63, 94, 0.2)",
                      color: "#f43f5e",
                      padding: "12px 20px",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(244, 63, 94, 0.15)";
                      e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(244, 63, 94, 0.08)";
                      e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.2)";
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out of Katitor</span>
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
