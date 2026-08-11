import React, { useState } from "react";
import {
  Flame,
  CheckCircle2,
  HelpCircle,
  Eye,
  Share2,
  Sparkles,
  Zap,
  TrendingUp,
  Target
} from "lucide-react";

export function AiClipExplanation({ candidate }) {
  const [expanded, setExpanded] = useState(false);
  if (!candidate) return null;

  const score = Math.round(candidate.score || 85);
  const bd = candidate.scoreBreakdown || {
    hook: 85,
    standalone: 82,
    curiosity: 80,
    payoff: 84,
    emotion: 78,
    formatFit: 88,
    visualInterest: 80,
    context: 85,
    shareability: 86
  };

  const dimensions = [
    { label: "Opening Hook", score: bd.hook || 85, color: "#f97316", icon: "🔥", desc: "First 3-second pattern interrupt" },
    { label: "Standalone Value", score: bd.standalone || 80, color: "#10b981", icon: "✓", desc: "Complete without outside context" },
    { label: "Curiosity Gap", score: bd.curiosity || 80, color: "#8b5cf6", icon: "⚡", desc: "Compelling question or dilemma" },
    { label: "Payoff / Insight", score: bd.payoff || 85, color: "#3b82f6", icon: "🎯", desc: "Concrete conclusion or delivery" },
    { label: "Emotion / Energy", score: bd.emotion || 75, color: "#ec4899", icon: "❤️", desc: "Conversational resonance" },
    { label: "9:16 Format Fit", score: bd.formatFit || 85, color: "#14b8a6", icon: "📱", desc: "Pacing & mobile composition" },
    { label: "Visual Interest", score: bd.visualInterest || 80, color: "#eab308", icon: "👁️", desc: "Speaker focus & dynamism" },
    { label: "Context Clarity", score: bd.context || 85, color: "#06b6d4", icon: "💡", desc: "Clear premise and terms" },
    { label: "Shareability", score: bd.shareability || 88, color: "#a855f7", icon: "🚀", desc: "High viral forwarding potential" },
  ];

  const platforms = Array.isArray(candidate.recommendedPlatforms) && candidate.recommendedPlatforms.length > 0
    ? candidate.recommendedPlatforms
    : ["TikTok", "Instagram Reels", "YouTube Shorts"];

  return (
    <div className="ai-explanation-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={14} color="#818cf8" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            WHY AI PICKED THIS ({score}/100)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "transparent",
            border: "none",
            color: "#818cf8",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 6px"
          }}
        >
          {expanded ? "Show Less" : "Score Breakdown"}
        </button>
      </div>

      {/* Recommended Platform Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
          Recommended:
        </span>
        {platforms.map((plat) => (
          <span
            key={plat}
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(99, 102, 241, 0.12)",
              color: "#c7d2fe",
              border: "1px solid rgba(99, 102, 241, 0.25)"
            }}
          >
            {plat}
          </span>
        ))}
      </div>

      {/* 9-Dimension Scoring Meters */}
      {expanded && (
        <div className="score-dimension-grid" style={{ marginTop: "4px" }}>
          {dimensions.map((dim) => (
            <div key={dim.label} className="score-dimension-item">
              <div className="score-dimension-header">
                <span>{dim.icon} {dim.label}</span>
                <strong style={{ color: dim.color }}>{Math.round(dim.score)}</strong>
              </div>
              <div className="score-dimension-bar">
                <div
                  className="score-dimension-fill"
                  style={{
                    width: `${Math.max(5, Math.min(100, dim.score))}%`,
                    background: dim.color
                  }}
                />
              </div>
              <span style={{ fontSize: "8.5px", color: "#64748b", marginTop: "1px" }}>{dim.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
