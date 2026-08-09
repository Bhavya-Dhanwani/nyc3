import { useState } from "react";
import api from "../lib/api.js";

export function RemoveSilenceModal({ projectId, open, onClose, onApply }) {
  const [settings, setSettings] = useState({ threshold: -35, minDuration: 0.5, padding: 0.1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  if (!open) return null;
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: Number(value) }));
  const detect = async () => {
    if (!projectId) { setError("Save or open a project before analyzing silence."); return; }
    setAnalyzing(true); setError(""); setResult(null);
    try { const response = await api.post(`/api/projects/${projectId}/detect-silence`, settings); setResult(response.data?.data); }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || "Could not analyze this video."); }
    finally { setAnalyzing(false); }
  };
  const total = result?.totalSilence || 0;
  return <div role="dialog" aria-modal="true" aria-label="Remove Silence" style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(5, 10, 20, .68)" }}>
    <form onSubmit={(event) => { event.preventDefault(); void detect(); }} style={{ width: "min(420px, calc(100vw - 32px))", padding: 24, borderRadius: 14, background: "#182033", color: "#fff", boxShadow: "0 20px 60px #0008" }}>
      <h2 style={{ marginTop: 0 }}>? Remove Silence</h2>
      <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>Silence threshold (dB)<input type="number" min="-60" max="-10" step="1" value={settings.threshold} onChange={(event) => update("threshold", event.target.value)} /></label>
      <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>Minimum silence duration (sec)<input type="number" min="0.1" max="10" step="0.1" value={settings.minDuration} onChange={(event) => update("minDuration", event.target.value)} /></label>
      <label style={{ display: "grid", gap: 6, marginBottom: 18 }}>Keep padding (sec)<input type="number" min="0" max="1" step="0.01" value={settings.padding} onChange={(event) => update("padding", event.target.value)} /></label>
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {result ? <div style={{ marginBottom: 18 }}><strong>{result.silences.length} silent sections found</strong><br />{total.toFixed(1)} seconds can be removed<br /><small>Original {result.duration.toFixed(1)} sec · After cut {result.estimatedDurationAfterCut.toFixed(1)} sec</small></div> : null}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={analyzing}>{analyzing ? "Analyzing audio…" : "Detect Silence"}</button>{result?.silences?.length ? <button type="button" onClick={() => onApply(result.silences)}>Apply to Timeline</button> : null}</div>
    </form>
  </div>;
}
