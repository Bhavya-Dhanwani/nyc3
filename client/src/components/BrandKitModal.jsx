import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Check,
  Palette,
  Type,
  Subtitles,
  Shield,
  Loader2
} from "lucide-react";
import api from "../lib/api.js";

export function BrandKitModal({ open, onClose, notify }) {
  const [brandKit, setBrandKit] = useState({
    logoUrl: null,
    primaryColor: "#6366f1",
    secondaryColor: "#a855f7",
    font: "Inter",
    captionStyle: "modern-box",
    captionHighlightColor: "#facc15",
    watermarkEnabled: false,
    watermarkText: "",
    watermarkPosition: "bottom-right",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/api/projects/brand-kit")
      .then((res) => {
        if (res.data?.data) {
          setBrandKit(res.data.data);
        }
      })
      .catch((e) => console.warn("Failed to load brand kit", e))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put("/api/projects/brand-kit", brandKit);
      notify?.("Brand Kit saved successfully!");
      onClose();
    } catch (e) {
      notify?.("Failed to save Brand Kit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="language-intro" style={{ zIndex: 1100 }}>
      <div className="language-intro-card" style={{ maxWidth: "560px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Palette size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#ffffff" }}>Brand Kit Settings</h3>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Inherited across all your generated Shorts</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
            <Loader2 size={24} className="spin" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Color Palette */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Brand Colors</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "6px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Primary Color:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <input
                      type="color"
                      value={brandKit.primaryColor}
                      onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
                      style={{ width: "36px", height: "32px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
                    />
                    <input
                      type="text"
                      value={brandKit.primaryColor}
                      onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
                      style={{ flex: 1, padding: "6px 8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
                    />
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Secondary / Accent:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <input
                      type="color"
                      value={brandKit.secondaryColor}
                      onChange={(e) => setBrandKit({ ...brandKit, secondaryColor: e.target.value })}
                      style={{ width: "36px", height: "32px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
                    />
                    <input
                      type="text"
                      value={brandKit.secondaryColor}
                      onChange={(e) => setBrandKit({ ...brandKit, secondaryColor: e.target.value })}
                      style={{ flex: 1, padding: "6px 8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography & Subtitles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Font Family</label>
                <select
                  value={brandKit.font}
                  onChange={(e) => setBrandKit({ ...brandKit, font: e.target.value })}
                  style={{ width: "100%", marginTop: "6px", padding: "8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: "6px", fontSize: "11px" }}
                >
                  <option value="Inter">Inter (Clean & Modern)</option>
                  <option value="Montserrat">Montserrat (Bold & Viral)</option>
                  <option value="Poppins">Poppins (Punchy)</option>
                  <option value="Roboto">Roboto (Classic)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Caption Highlight</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <input
                    type="color"
                    value={brandKit.captionHighlightColor}
                    onChange={(e) => setBrandKit({ ...brandKit, captionHighlightColor: e.target.value })}
                    style={{ width: "36px", height: "32px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
                  />
                  <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Highlight Pop Color</span>
                </div>
              </div>
            </div>

            {/* Watermark Section */}
            <div style={{ background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>Watermark / Handle</span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px", color: "#94a3b8" }}>
                  <input
                    type="checkbox"
                    checked={brandKit.watermarkEnabled}
                    onChange={(e) => setBrandKit({ ...brandKit, watermarkEnabled: e.target.checked })}
                  />
                  Enable Watermark
                </label>
              </div>

              {brandKit.watermarkEnabled && (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="@yourhandle or Brand"
                    value={brandKit.watermarkText}
                    onChange={(e) => setBrandKit({ ...brandKit, watermarkText: e.target.value })}
                    style={{ padding: "6px 8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
                  />
                  <select
                    value={brandKit.watermarkPosition}
                    onChange={(e) => setBrandKit({ ...brandKit, watermarkPosition: e.target.value })}
                    style={{ padding: "6px 8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "8px 16px", borderRadius: "6px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary-gradient"
                style={{ padding: "8px 20px", borderRadius: "6px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                <span>Save Brand Kit</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
