import React, { useState, useEffect, useRef, useMemo } from "react";
import api from "../lib/api.js";
import {
  Sparkles,
  Scissors,
  Loader2,
  Play,
  CheckCircle2,
  ArrowRight,
  Sliders,
  ExternalLink,
  Flame,
  Subtitles,
  Cpu,
  Zap,
  Volume2,
  Clock,
  Check,
  AlertCircle,
  Radio,
  Download,
  Share2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Eye,
  X
} from "lucide-react";
import { CONTENT_TYPES, REVIEW_STATUSES, getContentTypeConfig } from "../lib/contentTypes.js";
import { AiClipExplanation } from "./AiClipExplanation.jsx";
import { useRealtimePipeline } from "../hooks/useRealtimePipeline.js";

function formatSec(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AiClipGeneratorPanel({
  project,
  onLoadMomentIntoTimeline,
  onApplyCaptions,
  captionStyle,
  hasCaptions = false,
  onOpenContentMap,
}) {
  const [activeTab, setActiveTab] = useState("shorts"); // "shorts" | "captions"
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [selectedReviewFilter, setSelectedReviewFilter] = useState("all");

  const [candidates, setCandidates] = useState(project?.candidates || []);

  useEffect(() => {
    if (project?.candidates) {
      setCandidates(project.candidates);
    }
  }, [project?.candidates]);

  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [clipCount, setClipCount] = useState(5);
  const [durationStyle, setDurationStyle] = useState("mixed");
  const [transcriptionProvider, setTranscriptionProvider] = useState("auto");
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("hinglish");
  const [captionSplitMode, setCaptionSplitMode] = useState("smart");
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captionElapsedSec, setCaptionElapsedSec] = useState(0);
  const [captionProgressText, setCaptionProgressText] = useState("");
  const [appliedCaptionCount, setAppliedCaptionCount] = useState(null);
  const [error, setError] = useState(null);

  // Modals for extra details on candidate
  const [activeHookModalCandidate, setActiveHookModalCandidate] = useState(null);
  const [activeTitleModalCandidate, setActiveTitleModalCandidate] = useState(null);
  const [activeSocialModalCandidate, setActiveSocialModalCandidate] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const timerRef = useRef(null);
  const captionTimerRef = useRef(null);
  const projectId = project?._id || project?.id;

  const PIPELINE_STEPS = [
    { title: "Audio Extraction", desc: "Extracting source audio stream & wave data" },
    { title: "AI Speech-to-Text", desc: "Transcribing dialogue with word timestamps" },
    { title: "Content Intelligence & Scoring", desc: "Analyzing narrative hooks, topics & virality" },
    { title: "9:16 Shorts Generation", desc: "Building vertical crop framing & subtitles" }
  ];

  // Real-time Pipeline hook (SSE with automatic polling fallback)
  const realtimePipeline = useRealtimePipeline({
    projectId,
    active: Boolean(projectId),
    onUpdate: (data) => {
      if (data?.candidates?.length) {
        setCandidates(data.candidates);
      }
      if (data?.status === "transcribing") {
        setRunningPipeline(true);
        setPipelineStep(2);
      } else if (data?.status === "analyzing") {
        setRunningPipeline(true);
        setPipelineStep(3);
      }
    },
    onComplete: (data) => {
      setRunningPipeline(false);
      setPipelineStep(4);
      if (data?.candidates?.length) {
        setCandidates(data.candidates);
      }
    },
    onError: (err) => {
      setRunningPipeline(false);
      setError(String(err));
    }
  });

  // Filter candidates based on content type and review status
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (selectedContentType !== "all" && (c.contentType || "Viral").toLowerCase() !== selectedContentType.toLowerCase()) {
        return false;
      }
      if (selectedReviewFilter !== "all" && (c.reviewStatus || "ai_found") !== selectedReviewFilter) {
        return false;
      }
      return true;
    });
  }, [candidates, selectedContentType, selectedReviewFilter]);

  // Elapsed timer for Shorts pipeline
  useEffect(() => {
    if (runningPipeline) {
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runningPipeline]);

  // Trigger full auto pipeline
  const handleRunAutoPipeline = async () => {
    if (!projectId) return;
    try {
      setError(null);
      setRunningPipeline(true);
      setPipelineStep(1);

      await api.post(`/api/projects/${projectId}/auto-pipeline`, {
        clipCount,
        durationStyle,
        provider: transcriptionProvider,
        language: transcriptionLanguage,
        captionStyle: captionStyle || "modern-box"
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to run video pipeline");
      setRunningPipeline(false);
    }
  };

  // Update candidate review status (Approve / Reject / Reviewing)
  const handleUpdateReviewStatus = async (candidateId, newStatus) => {
    try {
      await api.put(`/api/candidates/${candidateId}/review-status`, { reviewStatus: newStatus });
      setCandidates((prev) =>
        prev.map((c) => (c._id === candidateId || c.id === candidateId ? { ...c, reviewStatus: newStatus } : c))
      );
    } catch (e) {
      console.warn("Failed to update review status", e);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadClip = async (candidate) => {
    const candidateId = candidate._id || candidate.id;
    if (!candidateId || downloadingClipId) return;

    try {
      setError(null);
      setDownloadingClipId(candidateId);
      const res = await api.get(`/api/candidates/${candidateId}/download`, {
        responseType: "blob"
      });
      const disposition = res.headers?.["content-disposition"] || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fallbackName = `${candidate.title || "generated-short"}.mp4`.replace(/[\\/:*?"<>|]+/g, "_");
      downloadMediaBlob(res.data, filenameMatch?.[1] || fallbackName);
    } catch (err) {
      console.error("Failed to download generated clip:", err);
      let message = err.message || "Failed to download generated clip";
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          message = JSON.parse(text)?.message || text || message;
        } catch {
          message = err.response?.statusText || message;
        }
      } else if (data?.message) {
        message = data.message;
      }
      setError(message);
    } finally {
      setDownloadingClipId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", color: "#f4f4f5" }}>
      {/* Top Banner & Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <Sparkles size={18} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#ffffff" }}>AI Content Intelligence</h2>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Extract, Rank, and Auto-Edit Viral Shorts</span>
          </div>
        </div>

        {onOpenContentMap && (
          <button
            type="button"
            className="layout-pill-btn"
            onClick={onOpenContentMap}
            title="Open Interactive Content Map"
          >
            <span>⚡ Content Map</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "8px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("shorts")}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            background: activeTab === "shorts" ? "rgba(99, 102, 241, 0.2)" : "transparent",
            color: activeTab === "shorts" ? "#c4b5fd" : "#a1a1aa",
            border: activeTab === "shorts" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          AI Viral Shorts ({candidates.length})
        </button>
      </div>

      {/* Main Generator Action Card */}
      <div style={{
        background: "rgba(0, 0, 0, 0.35)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#94a3b8" }}>Opportunity Count:</label>
            <select
              value={clipCount}
              disabled={runningPipeline}
              onChange={(e) => setClipCount(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "8px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "11px"
              }}
            >
              <option value={3}>Top 3 Opportunities</option>
              <option value={5}>Top 5 Opportunities</option>
              <option value={8}>Top 8 Opportunities</option>
              <option value={12}>Top 12 Opportunities</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", color: "#94a3b8" }}>Recognition Model:</label>
            <select
              value={transcriptionProvider}
              disabled={runningPipeline}
              onChange={(e) => setTranscriptionProvider(e.target.value)}
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "8px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "11px"
              }}
            >
              <option value="auto">⚡ Auto Smart (Groq / OpenAI / Deepgram)</option>
              <option value="groq">Groq Whisper (Ultra Fast)</option>
              <option value="openai">OpenAI Whisper Cloud</option>
              <option value="deepgram">Deepgram Nova-2</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunAutoPipeline}
          disabled={runningPipeline}
          className="btn-primary-gradient"
          style={{
            padding: "12px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: "8px",
            cursor: runningPipeline ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {runningPipeline ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Analyzing Video & Generating Content ({formatSec(elapsedSec)})...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Analyze & Generate Content Intelligence</span>
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: "12px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          color: "#f87171",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Content Type & Review Status Filters */}
      {candidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Content Types Chips */}
          <div className="content-map-filter-bar">
            <button
              type="button"
              className={`content-type-filter-chip ${selectedContentType === "all" ? "is-active" : ""}`}
              onClick={() => setSelectedContentType("all")}
            >
              <span>ALL ({candidates.length})</span>
            </button>
            {CONTENT_TYPES.map((type) => {
              const count = candidates.filter((c) => (c.contentType || "Viral").toLowerCase() === type.id.toLowerCase()).length;
              if (count === 0) return null;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`content-type-filter-chip ${selectedContentType === type.id ? "is-active" : ""}`}
                  onClick={() => setSelectedContentType(type.id)}
                  style={selectedContentType === type.id ? { borderColor: type.color, color: "#ffffff", background: type.bg } : undefined}
                >
                  <span>{type.icon}</span>
                  <span>{type.label} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* Human Review Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto" }}>
            {REVIEW_STATUSES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedReviewFilter(st.id)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "10px",
                  fontWeight: 600,
                  border: selectedReviewFilter === st.id ? "1px solid #818cf8" : "1px solid rgba(255,255,255,0.06)",
                  background: selectedReviewFilter === st.id ? "rgba(99,102,241,0.2)" : "rgba(0,0,0,0.2)",
                  color: selectedReviewFilter === st.id ? "#c7d2fe" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Candidate Opportunities Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredCandidates.map((candidate, idx) => {
          const start = Number(candidate.startSec ?? candidate.start) || 0;
          const end = Number(candidate.endSec ?? candidate.end) || (start + 30);
          const duration = (end - start).toFixed(1);
          const score = candidate.score || 85;
          const cfg = getContentTypeConfig(candidate.contentType);
          const candidateId = candidate._id || candidate.id;
          const reviewStatus = candidate.reviewStatus || "ai_found";

          return (
            <div
              key={candidateId || idx}
              style={{
                padding: "14px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              {/* Header with Type, Title, and Score */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: cfg.bg,
                      color: cfg.color,
                      border: `1px solid ${cfg.border}`
                    }}>
                      {cfg.icon} {candidate.contentType || "Viral"}
                    </span>

                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: reviewStatus === "approved" ? "rgba(16,185,129,0.2)" : reviewStatus === "rejected" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)",
                      color: reviewStatus === "approved" ? "#34d399" : reviewStatus === "rejected" ? "#f87171" : "#94a3b8"
                    }}>
                      {reviewStatus.toUpperCase()}
                    </span>
                  </div>

                  <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                    {candidate.title || `Moment #${idx + 1}`}
                  </h4>

                  <p style={{ fontSize: "11px", color: "#71717a", margin: "3px 0 0 0" }}>
                    {formatSec(start)} - {formatSec(end)} ({duration}s duration)
                  </p>
                </div>

                <div style={{
                  padding: "3px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <Flame size={13} />
                  <span>{Math.round(score)}%</span>
                </div>
              </div>

              {/* Hook text */}
              {candidate.hook && (
                <div style={{
                  fontSize: "11.5px",
                  color: "#e2e8f0",
                  fontStyle: "italic",
                  background: "rgba(0, 0, 0, 0.25)",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  borderLeft: `3px solid ${cfg.color}`,
                  lineHeight: 1.4
                }}>
                  "{candidate.hook}"
                </div>
              )}

              {/* Action Tabs Bar: Hooks | Titles | Social Posts | Score */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setActiveHookModalCandidate(candidate)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(99, 102, 241, 0.12)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    color: "#a5b4fc",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Sparkles size={12} />
                  <span>5 AI Hooks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTitleModalCandidate(candidate)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(168, 85, 247, 0.12)",
                    border: "1px solid rgba(168, 85, 247, 0.25)",
                    color: "#d8b4fe",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <FileText size={12} />
                  <span>AI Titles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSocialModalCandidate(candidate)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(6, 182, 212, 0.12)",
                    border: "1px solid rgba(6, 182, 212, 0.25)",
                    color: "#67e8f9",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Share2 size={12} />
                  <span>Social Posts</span>
                </button>
              </div>

              {/* Human Review Approval & Timeline Open Bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)"
              }}>
                {/* Human Review Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleUpdateReviewStatus(candidateId, reviewStatus === "approved" ? "ai_found" : "approved")}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: reviewStatus === "approved" ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                      background: reviewStatus === "approved" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                      color: reviewStatus === "approved" ? "#34d399" : "#94a3b8",
                      cursor: "pointer",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    title="Approve clip for production"
                  >
                    <ThumbsUp size={12} />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateReviewStatus(candidateId, reviewStatus === "rejected" ? "ai_found" : "rejected")}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: reviewStatus === "rejected" ? "#ef4444" : "rgba(255, 255, 255, 0.1)",
                      background: reviewStatus === "rejected" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                      color: reviewStatus === "rejected" ? "#f87171" : "#94a3b8",
                      cursor: "pointer",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    title="Reject clip"
                  >
                    <ThumbsDown size={12} />
                    <span>Reject</span>
                  </button>
                </div>

                {/* Open & Download Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadClip(candidate)}
                    className="btn-secondary"
                    style={{
                      padding: "6px 10px",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLoadMomentIntoTimeline({
                      start,
                      end,
                      title: candidate.title,
                      aspectRatio: candidate.aspectRatio || "vertical",
                      rank: candidate.rank || idx + 1,
                      layout: candidate.layout,
                      focusX: candidate.focusX,
                      focusY: candidate.focusY,
                      zoomFactor: candidate.zoomFactor,
                      smartFrame: candidate.smartFrame
                    })}
                    className="btn-primary-gradient"
                    style={{
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                  >
                    <span>Open on Timeline</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5 AI Hooks Modal */}
      {activeHookModalCandidate && (
        <div className="language-intro" style={{ zIndex: 1100 }}>
          <div className="language-intro-card" style={{ maxWidth: "600px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#818cf8" />
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff" }}>AI Hook Variations (5 Styles)</h3>
              </div>
              <button type="button" onClick={() => setActiveHookModalCandidate(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(activeHookModalCandidate.suggestedHooks || []).map((h, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#818cf8", textTransform: "uppercase" }}>
                      {h.hookType || `Style #${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(h.hook, `hook-${i}`)}
                      style={{ background: "transparent", border: "none", color: copiedKey === `hook-${i}` ? "#4ade80" : "#94a3b8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      {copiedKey === `hook-${i}` ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === `hook-${i}` ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: "12px", color: "#ffffff", fontWeight: 500 }}>"{h.hook}"</div>
                  {h.reason && <div style={{ fontSize: "10px", color: "#94a3b8" }}>Why: {h.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Titles Modal */}
      {activeTitleModalCandidate && (
        <div className="language-intro" style={{ zIndex: 1100 }}>
          <div className="language-intro-card" style={{ maxWidth: "560px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={18} color="#a855f7" />
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff" }}>High-CTR AI Title Styles</h3>
              </div>
              <button type="button" onClick={() => setActiveTitleModalCandidate(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(activeTitleModalCandidate.suggestedTitles || []).map((tItem, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "9.5px", color: "#a855f7", fontWeight: 700, textTransform: "uppercase" }}>{tItem.style || "Direct"}</span>
                    <div style={{ fontSize: "12px", color: "#fff", fontWeight: 500, marginTop: "2px" }}>{tItem.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(tItem.title, `title-${i}`)}
                    style={{ background: "transparent", border: "none", color: copiedKey === `title-${i}` ? "#4ade80" : "#94a3b8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    {copiedKey === `title-${i}` ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Social Posts Modal */}
      {activeSocialModalCandidate && (
        <div className="language-intro" style={{ zIndex: 1100 }}>
          <div className="language-intro-card" style={{ maxWidth: "650px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Share2 size={18} color="#06b6d4" />
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff" }}>Ready Platform Social Content</h3>
              </div>
              <button type="button" onClick={() => setActiveSocialModalCandidate(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Instagram */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#ec4899" }}>📷 Instagram (Reels & Caption)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${activeSocialModalCandidate.suggestedCaptions?.instagram?.caption || ""}\n\n${activeSocialModalCandidate.suggestedCaptions?.instagram?.cta || ""}\n\n${activeSocialModalCandidate.suggestedCaptions?.instagram?.hashtags || ""}`, "social-ig")}
                    style={{ background: "transparent", border: "none", color: copiedKey === "social-ig" ? "#4ade80" : "#94a3b8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    {copiedKey === "social-ig" ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === "social-ig" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                  {activeSocialModalCandidate.suggestedCaptions?.instagram?.caption || "Insightful viral clip highlight."}
                  {"\n\n"}
                  {activeSocialModalCandidate.suggestedCaptions?.instagram?.cta || "Save this post for later 📌"}
                  {"\n\n"}
                  <span style={{ color: "#818cf8" }}>{activeSocialModalCandidate.suggestedCaptions?.instagram?.hashtags || "#viral #shorts #reels"}</span>
                </div>
              </div>

              {/* TikTok */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#06b6d4" }}>🎵 TikTok (Hook & Caption)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${activeSocialModalCandidate.suggestedCaptions?.tiktok?.caption || ""}\n\n${activeSocialModalCandidate.suggestedCaptions?.tiktok?.hashtags || ""}`, "social-tt")}
                    style={{ background: "transparent", border: "none", color: copiedKey === "social-tt" ? "#4ade80" : "#94a3b8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    {copiedKey === "social-tt" ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === "social-tt" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "#cbd5e1", whiteSpace: "pre-line" }}>
                  {activeSocialModalCandidate.suggestedCaptions?.tiktok?.caption || "Wait till the end 🤯"}
                  {"\n\n"}
                  <span style={{ color: "#06b6d4" }}>{activeSocialModalCandidate.suggestedCaptions?.tiktok?.hashtags || "#fyp #viral #learnontiktok"}</span>
                </div>
              </div>

              {/* LinkedIn */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#3b82f6" }}>💼 LinkedIn (Professional Post)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeSocialModalCandidate.suggestedCaptions?.linkedin?.post || "", "social-li")}
                    style={{ background: "transparent", border: "none", color: copiedKey === "social-li" ? "#4ade80" : "#94a3b8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    {copiedKey === "social-li" ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === "social-li" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                  {activeSocialModalCandidate.suggestedCaptions?.linkedin?.post || "Key leadership and technical takeaways from this discussion."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiClipGeneratorPanel;
