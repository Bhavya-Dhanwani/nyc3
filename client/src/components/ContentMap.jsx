import React, { useState, useMemo } from "react";
import { CONTENT_TYPES, REVIEW_STATUSES, getContentTypeConfig } from "../lib/contentTypes.js";
import {
  Sparkles,
  Flame,
  Clock,
  Play,
  ArrowRight,
  Filter,
  SlidersHorizontal,
  CheckCircle,
  Eye,
  X,
  Share2,
  ThumbsUp,
  Download
} from "lucide-react";
import { AiClipExplanation } from "./AiClipExplanation.jsx";

function formatTimestamp(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ContentMap({
  candidates = [],
  totalDuration = 60,
  selectedCandidateId,
  onSelectCandidate,
  onSeekTo,
  onLoadMomentIntoTimeline,
  onUpdateReviewStatus,
  onClose,
  activeOperations = [],
  onCancelOperation
}) {
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState("score"); // "score" | "time" | "duration"
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  const activeAnalysisOp = useMemo(() => {
    return activeOperations.find((o) => o.type === "VIDEO_ANALYSIS" || o.type === "TRANSCRIPTION");
  }, [activeOperations]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((c) => {
        if (selectedType !== "all" && (c.contentType || "Viral").toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
        if (selectedStatus !== "all" && (c.reviewStatus || "ai_found") !== selectedStatus) {
          return false;
        }
        if ((c.score || 85) < minScore) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score") return (b.score || 0) - (a.score || 0);
        if (sortBy === "time") return (a.startSec ?? a.start ?? 0) - (b.startSec ?? b.start ?? 0);
        if (sortBy === "duration") return ((b.endSec ?? b.end ?? 0) - (b.startSec ?? b.start ?? 0)) - ((a.endSec ?? a.end ?? 0) - (a.startSec ?? a.start ?? 0));
        return 0;
      });
  }, [candidates, selectedType, selectedStatus, minScore, sortBy]);

  const activeCandidate = useMemo(() => {
    return candidates.find((c) => (c._id || c.id) === selectedCandidateId) || filteredCandidates[0] || candidates[0] || null;
  }, [candidates, selectedCandidateId, filteredCandidates]);

  const maxVideoDuration = Math.max(totalDuration || 60, ...candidates.map((c) => Number(c.endSec ?? c.end ?? 0) || 60));

  return (
    <div className="content-map-container" role="region" aria-label="Content Intelligence Map">
      {/* Top Header Bar */}
      <div className="content-map-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px rgba(99, 102, 241, 0.5)"
          }}>
            <Sparkles size={18} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#ffffff", letterSpacing: "0.02em" }}>
                CONTENT MAP & INTELLIGENCE
              </h3>
              <span style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(99, 102, 241, 0.2)",
                color: "#a5b4fc",
                border: "1px solid rgba(99, 102, 241, 0.4)"
              }}>
                {filteredCandidates.length} Opportunities Found
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
              Visual map of high-retention moments across your {formatTimestamp(maxVideoDuration)} video
            </p>
          </div>
        </div>

        {/* Controls & Sorting */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "5px 8px",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#e2e8f0",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            <option value="score">Sort: Highest Virality Score</option>
            <option value="time">Sort: Timeline Position (Start)</option>
            <option value="duration">Sort: Duration</option>
          </select>

          {onClose && (
            <button
              type="button"
              className="layout-icon-btn"
              onClick={onClose}
              title="Close Content Map"
              style={{ padding: "6px" }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Live AI Analysis Progress Card */}
      {activeAnalysisOp && (
        <div style={{
          margin: "10px 16px 4px 16px",
          padding: "12px 16px",
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              <strong style={{ fontSize: "12px", color: "#e0e7ff" }}>
                {activeAnalysisOp.title}: {activeAnalysisOp.message}
              </strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#818cf8" }}>
                {activeAnalysisOp.progress}%
              </span>
              {activeAnalysisOp.cancellable && onCancelOperation && (
                <button
                  type="button"
                  onClick={() => onCancelOperation(activeAnalysisOp.operationId)}
                  style={{
                    fontSize: "10px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(244, 63, 94, 0.15)",
                    color: "#fb7185",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", height: "4px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              width: `${Math.max(3, activeAnalysisOp.progress)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #6366f1, #a855f7)",
              borderRadius: "2px",
              transition: "width 0.3s ease"
            }} />
          </div>

          {/* Step checklist preview */}
          {activeAnalysisOp.steps && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
              {activeAnalysisOp.steps.map((s, idx) => (
                <span
                  key={s.id || idx}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: s.status === "completed"
                      ? "rgba(16, 185, 129, 0.15)"
                      : s.status === "running"
                      ? "rgba(99, 102, 241, 0.25)"
                      : "rgba(255, 255, 255, 0.05)",
                    color: s.status === "completed"
                      ? "#34d399"
                      : s.status === "running"
                      ? "#a5b4fc"
                      : "#64748b",
                    border: s.status === "running" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
                    fontWeight: s.status === "running" ? 600 : 400
                  }}
                >
                  {s.status === "completed" ? "✓ " : s.status === "running" ? "● " : "○ "}
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Type Filter Pills */}
      <div className="content-map-filter-bar">
        <button
          type="button"
          className={`content-type-filter-chip ${selectedType === "all" ? "is-active" : ""}`}
          onClick={() => setSelectedType("all")}
        >
          <span>ALL ({candidates.length})</span>
        </button>
        {CONTENT_TYPES.map((type) => {
          const count = candidates.filter((c) => (c.contentType || "Viral").toLowerCase() === type.id.toLowerCase()).length;
          return (
            <button
              key={type.id}
              type="button"
              className={`content-type-filter-chip ${selectedType === type.id ? "is-active" : ""}`}
              onClick={() => setSelectedType(type.id)}
              style={selectedType === type.id ? { borderColor: type.color, color: "#ffffff", background: type.bg } : undefined}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
              {count > 0 && <span style={{ opacity: 0.7, fontSize: "10px" }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Hero Visual Timeline Track */}
      <div className="content-map-track-shell">
        <div style={{ position: "absolute", left: "10px", top: "6px", fontSize: "9px", color: "#64748b", fontFamily: "monospace" }}>
          00:00
        </div>
        <div style={{ position: "absolute", right: "10px", top: "6px", fontSize: "9px", color: "#64748b", fontFamily: "monospace" }}>
          {formatTimestamp(maxVideoDuration)}
        </div>

        <div className="content-map-track-line" />

        {/* Opportunity Markers on Timeline */}
        {filteredCandidates.map((candidate) => {
          const start = Number(candidate.startSec ?? candidate.start) || 0;
          const end = Number(candidate.endSec ?? candidate.end) || (start + 30);
          const percent = Math.max(2, Math.min(98, (start / maxVideoDuration) * 100));
          const isSelected = (candidate._id || candidate.id) === (activeCandidate?._id || activeCandidate?.id);
          const typeConfig = getContentTypeConfig(candidate.contentType);

          return (
            <div
              key={candidate._id || candidate.id || start}
              className={`content-map-marker ${isSelected ? "is-selected" : ""}`}
              style={{ left: `${percent}%` }}
              onClick={() => {
                const id = candidate._id || candidate.id;
                onSelectCandidate?.(id);
                onSeekTo?.(start);
              }}
              title={`${candidate.title || "Clip"} (${formatTimestamp(start)} - ${formatTimestamp(end)}) | Score: ${candidate.score}%`}
            >
              <div
                className="content-map-marker-pin"
                style={{
                  background: isSelected ? typeConfig.color : typeConfig.bg,
                  borderColor: isSelected ? "#ffffff" : typeConfig.border
                }}
              >
                {typeConfig.icon}
              </div>
              <span className="content-map-marker-score" style={{ color: isSelected ? "#a5b4fc" : "#cbd5e1" }}>
                {Math.round(candidate.score || 85)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active Candidate Detailed Intelligence Card */}
      {activeCandidate && (
        <div style={{
          background: "rgba(10, 14, 20, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "10px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: getContentTypeConfig(activeCandidate.contentType).bg,
                  color: getContentTypeConfig(activeCandidate.contentType).color,
                  border: `1px solid ${getContentTypeConfig(activeCandidate.contentType).border}`
                }}>
                  {getContentTypeConfig(activeCandidate.contentType).icon} {activeCandidate.contentType || "Viral"}
                </span>

                {activeCandidate.hookType && (
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "#94a3b8"
                  }}>
                    Hook: {activeCandidate.hookType}
                  </span>
                )}

                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  ⏱️ {formatTimestamp(Number(activeCandidate.startSec ?? activeCandidate.start) || 0)} - {formatTimestamp(Number(activeCandidate.endSec ?? activeCandidate.end) || 60)} ({((Number(activeCandidate.endSec ?? activeCandidate.end) || 60) - (Number(activeCandidate.startSec ?? activeCandidate.start) || 0)).toFixed(1)}s)
                </span>
              </div>

              <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px 0" }}>
                {activeCandidate.title || "Viral Moment"}
              </h4>

              {activeCandidate.hook && (
                <div style={{
                  fontSize: "12px",
                  color: "#e2e8f0",
                  fontStyle: "italic",
                  background: "rgba(0, 0, 0, 0.35)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  borderLeft: `3px solid ${getContentTypeConfig(activeCandidate.contentType).color}`,
                  marginBottom: "8px"
                }}>
                  "{activeCandidate.hook}"
                </div>
              )}

              {activeCandidate.rationale && (
                <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: "#cbd5e1" }}>AI Rationale:</strong> {activeCandidate.rationale}
                </p>
              )}
            </div>

            {/* Virality Score Badge & Actions */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                color: "#ffffff"
              }}>
                <Flame size={16} color="#fbbf24" />
                <span style={{ fontSize: "16px", fontWeight: 800 }}>{Math.round(activeCandidate.score || 85)}</span>
                <span style={{ fontSize: "10px", color: "#a5b4fc" }}>/ 100</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => onSeekTo?.(Number(activeCandidate.startSec ?? activeCandidate.start) || 0)}
                  className="layout-icon-btn"
                  style={{ background: "rgba(255, 255, 255, 0.06)", padding: "6px 10px", borderRadius: "6px" }}
                  title="Seek player to moment start"
                >
                  <Play size={13} />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const start = Number(activeCandidate.startSec ?? activeCandidate.start) || 0;
                    const end = Number(activeCandidate.endSec ?? activeCandidate.end) || (start + 60);
                    onLoadMomentIntoTimeline?.({
                      start,
                      end,
                      title: activeCandidate.title,
                      aspectRatio: "vertical",
                      rank: activeCandidate.rank || 1
                    });
                  }}
                  className="btn-primary-gradient"
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  <span>Open on Timeline</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Explainable Score Factors Accordion / Grid */}
          <AiClipExplanation candidate={activeCandidate} />
        </div>
      )}
    </div>
  );
}
