import React, { useState, useEffect } from "react";
import {
  BarChart3,
  X,
  Clock,
  Flame,
  CheckCircle2,
  Film,
  Video,
  Sparkles,
  Loader2,
  TrendingUp
} from "lucide-react";
import api from "../lib/api.js";
import { getContentTypeConfig } from "../lib/contentTypes.js";

export function AnalyticsModal({ open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/api/projects/analytics")
      .then((res) => {
        if (res.data?.data) {
          setData(res.data.data);
        }
      })
      .catch((e) => console.warn("Failed to load analytics", e))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="language-intro" style={{ zIndex: 1100 }}>
      <div className="language-intro-card" style={{ maxWidth: "680px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <BarChart3 size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#ffffff" }}>Project & AI Analytics</h3>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Real verified metrics computed directly from your workspace</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "48px", display: "flex", justifyContent: "center" }}>
            <Loader2 size={28} className="spin" />
          </div>
        ) : !data || data.videosProcessed === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontSize: "13px" }}>
            No project data yet. Process your first video to see live AI virality statistics.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Top Stat Counters */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#818cf8", fontSize: "11px", fontWeight: 600 }}>
                  <Video size={14} />
                  <span>Videos & Minutes</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                  {data.videosProcessed} <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 400 }}>({data.minutesProcessed} mins)</span>
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f59e0b", fontSize: "11px", fontWeight: 600 }}>
                  <Sparkles size={14} />
                  <span>Viral Opportunities</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                  {data.opportunitiesFound}
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "11px", fontWeight: 600 }}>
                  <Clock size={14} />
                  <span>Hours Saved</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                  ~{data.estimatedHoursSaved} <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 400 }}>hrs</span>
                </div>
              </div>
            </div>

            {/* Second Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Shorts Status</span>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>{data.shortsGenerated}</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>Rendered Clips</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#34d399" }}>{data.shortsApproved}</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>Human Approved</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#fbbf24" }}>{data.averageScore}%</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>Avg Virality</div>
                  </div>
                </div>
              </div>

              {/* Content Type Breakdown */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Content Types Found</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {Object.entries(data.contentTypeDistribution || {}).map(([type, count]) => {
                    const cfg = getContentTypeConfig(type);
                    return (
                      <span
                        key={type}
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: cfg.bg,
                          color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {cfg.icon} {type}: <strong>{count}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                style={{ padding: "8px 18px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
