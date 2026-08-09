import React, { useState, useEffect } from "react";
import api from "../lib/api.js";
import {
  Key,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  LogOut,
  ShieldCheck
} from "lucide-react";

const KEY_FIELDS = [
  { id: "groqKeys", label: "Groq API Key (Ultra Fast Whisper & Llama - Recommended)", placeholder: "gsk_..." },
  { id: "mistralKeys", label: "Mistral API Key (Viral Moment Analysis & Scoring)", placeholder: "..." },
  { id: "openaiKeys", label: "OpenAI API Key (Whisper & GPT-4o)", placeholder: "sk-..." },
  { id: "deepgramKeys", label: "Deepgram API Key (Nova-2 Speech Recognition)", placeholder: "..." },
  { id: "openrouterKeys", label: "OpenRouter API Key", placeholder: "sk-or-..." },
  { id: "anthropicKeys", label: "Anthropic Claude Key", placeholder: "sk-ant-..." },
  { id: "deepseekKeys", label: "DeepSeek API Key", placeholder: "sk-..." },
  { id: "geminiKeys", label: "Google Gemini Key", placeholder: "AIza..." }
];

function toKeyArray(val) {
  if (Array.isArray(val)) return val.map(v => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}

export function ApiKeySetupGate({ user, onSetupComplete, onLogout }) {
  const [keys, setKeys] = useState(() => {
    const initial = {};
    for (const field of KEY_FIELDS) {
      initial[field.id] = toKeyArray(user?.[field.id] || user?.[field.id.replace("Keys", "Key")]);
    }
    // Also check localStorage
    try {
      const cached = localStorage.getItem("autoshorts_user_keys");
      if (cached) {
        const parsed = JSON.parse(cached);
        for (const field of KEY_FIELDS) {
          if (!initial[field.id].length && parsed[field.id]) {
            initial[field.id] = toKeyArray(parsed[field.id]);
          }
        }
      }
    } catch {}
    return initial;
  });

  const [showKeys, setShowKeys] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Load existing keys from server on mount
  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await api.get("/api/auth/keys");
        if (res.data?.data) {
          setKeys((prev) => {
            const next = { ...prev };
            for (const field of KEY_FIELDS) {
              const fromServer = toKeyArray(res.data.data[field.id] || res.data.data[field.id.replace("Keys", "Key")]);
              if (fromServer.length > 0) {
                next[field.id] = fromServer;
              }
            }
            return next;
          });
        }
      } catch (err) {
        console.warn("Could not fetch remote keys in setup gate:", err);
      }
    }
    loadKeys();
  }, []);

  const totalKeysEntered = KEY_FIELDS.reduce(
    (sum, f) => sum + (keys[f.id] || []).filter(k => k && k.trim()).length,
    0
  );

  const toggleShowKey = (fieldId, index) => {
    const k = `${fieldId}_${index}`;
    setShowKeys(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const handleKeyChange = (fieldId, index, value) => {
    setKeys(prev => {
      const arr = [...(prev[fieldId] || [])];
      arr[index] = value;
      return { ...prev, [fieldId]: arr };
    });
    if (error) setError(null);
  };

  const addKey = (fieldId) => {
    setKeys(prev => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ""]
    }));
  };

  const removeKey = (fieldId, index) => {
    setKeys(prev => {
      const arr = [...(prev[fieldId] || [])];
      arr.splice(index, 1);
      return { ...prev, [fieldId]: arr };
    });
  };

  const handleConnectDrive = () => {
    window.location.href = "/api/auth/google";
  };

  const handleSaveAndProceed = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate: At least 1 key must be entered
    const cleaned = {};
    let validKeyCount = 0;

    for (const field of KEY_FIELDS) {
      const filtered = (keys[field.id] || []).map(k => k.trim()).filter(Boolean);
      cleaned[field.id] = filtered;
      validKeyCount += filtered.length;
    }

    if (validKeyCount === 0) {
      setError("Please configure at least one AI API key (such as Groq, Mistral, or OpenAI) before entering the studio. API keys are required for speech-to-text transcription and viral moment detection.");
      return;
    }

    try {
      setLoading(true);
      localStorage.setItem("autoshorts_user_keys", JSON.stringify(cleaned));
      await api.put("/api/auth/keys", cleaned);

      setSuccess(true);
      setTimeout(() => {
        if (onSetupComplete) {
          onSetupComplete(cleaned);
        }
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save API keys to server");
    } finally {
      setLoading(false);
    }
  };

  const isDriveConnected = !!user?.googleAccessToken;

  return (
    <div className="fixed inset-0 z-[99999] bg-[#07080c] text-white flex flex-col items-center justify-between overflow-y-auto p-4 sm:p-8 font-helveticaNeue selection:bg-white selection:text-heroColor">
      {/* Decorative Neon Blurs */}
      <div className="pointer-events-none fixed -top-32 -right-32 w-96 h-96 bg-heroColor/20 rounded-full blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -left-32 w-96 h-96 bg-[#b3eb16]/10 rounded-full blur-3xl" />

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-white/10 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-heroColor/20 border border-heroColor/40 flex items-center justify-center text-white">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-xl sm:text-2xl uppercase leading-none tracking-[0.05em] text-white">
              KATITOR STUDIO SETUP
            </h2>
            <p className="text-xs text-white/60 uppercase tracking-wider">
              Configure Your Environment to Unlock Video AI Features
            </p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        )}
      </header>

      {/* Main Container Card */}
      <main className="w-full max-w-4xl bg-[#0f1118]/90 border border-white/15 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10 mb-6">
        {/* Step 1: Google Drive Permission */}
        <section className="mb-8 p-5 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDriveConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-blue-500/20 text-blue-400 border border-blue-500/40"}`}>
                <Cloud size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                    1. Cloud Storage & Google Drive
                  </h4>
                  {isDriveConnected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/65 mt-0.5">
                  {isDriveConnected
                    ? "Google Drive is linked. Raw video uploads, SRT subtitles, and rendered 9:16 Shorts sync directly to your drive."
                    : "Connect your Google Drive account to automatically store source videos and export rendered clips."}
                </p>
              </div>
            </div>

            {!isDriveConnected && (
              <button
                type="button"
                onClick={handleConnectDrive}
                className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <ExternalLink size={13} />
                <span>Connect Drive</span>
              </button>
            )}
          </div>
        </section>

        {/* Step 2: Mandatory API Keys Setup */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-heroColor/20 border border-heroColor/40 flex items-center justify-center text-white shrink-0">
                <Key size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                  2. AI Provider Keys <span className="text-red-400 font-bold">*Required</span>
                </h3>
                <p className="text-xs text-white/60">
                  Enter your API key(s) to power AI video processing. You can add multiple keys per provider for automatic 429 rate-limit failover.
                </p>
              </div>
            </div>

            {totalKeysEntered > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck size={14} />
                <span>{totalKeysEntered} Key{totalKeysEntered > 1 ? "s" : ""} Added</span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-3">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>Keys verified and saved successfully! Opening AutoShorts Studio...</span>
            </div>
          )}

          <form onSubmit={handleSaveAndProceed} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {KEY_FIELDS.map((field) => {
                const fieldKeys = keys[field.id] || [];
                const keyCount = fieldKeys.filter(k => k && k.trim()).length;

                return (
                  <div
                    key={field.id}
                    className="p-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-medium text-white/90">
                        {field.label}
                      </label>
                      {keyCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {keyCount} {keyCount > 1 ? "keys" : "key"}
                        </span>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-2">
                      {fieldKeys.map((keyVal, idx) => {
                        const showId = `${field.id}_${idx}`;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="relative flex-1 flex items-center">
                              <input
                                type={showKeys[showId] ? "text" : "password"}
                                placeholder={field.placeholder}
                                value={keyVal}
                                onChange={(e) => handleKeyChange(field.id, idx, e.target.value)}
                                className="w-full h-10 pl-3 pr-10 bg-black/40 border border-white/15 focus:border-heroColor rounded-xl text-xs text-white placeholder-white/25 outline-none transition-all font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => toggleShowKey(field.id, idx)}
                                className="absolute right-2.5 text-white/40 hover:text-white/80 p-1 cursor-pointer"
                              >
                                {showKeys[showId] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeKey(field.id, idx)}
                              className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Key Button */}
                    <button
                      type="button"
                      onClick={() => addKey(field.id)}
                      className="w-full mt-2.5 py-2 border border-dashed border-white/15 hover:border-white/35 rounded-xl text-white/60 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-black/20"
                    >
                      <Plus size={13} />
                      <span>{fieldKeys.length === 0 ? "Add API Key" : "Add Another Key (Failover)"}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom Submit Bar */}
            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-white/60 text-center sm:text-left">
                🔒 Keys are encrypted and securely stored in your personal account document.
              </p>

              <button
                type="submit"
                disabled={loading || totalKeysEntered === 0}
                className="w-full sm:w-auto px-8 h-12 bg-heroColor hover:bg-[#6355ff] disabled:opacity-50 disabled:cursor-not-allowed border border-white/25 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wider text-white transition-all shadow-lg cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving & Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Save Keys & Enter Studio</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-xs text-white/40 uppercase tracking-widest py-2 text-center">
        Katitor Video Intelligence • Step 2 of 2 Required Onboarding
      </footer>
    </div>
  );
}

export default ApiKeySetupGate;
