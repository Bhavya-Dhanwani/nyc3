import React, { useState, useEffect, useRef } from "react";
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
  Download
} from "lucide-react";

export function AiClipGeneratorPanel({
  project,
  onLoadMomentIntoTimeline,
  onApplyCaptions,
  captionStyle,
  hasCaptions = false
}) {
  const [activeTab, setActiveTab] = useState("shorts"); // "shorts" | "captions"
  const [candidates, setCandidates] = useState(project?.candidates || []);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: idle, 1: audio, 2: transcribe, 3: llm, 4: complete
  const [elapsedSec, setElapsedSec] = useState(0);
  const [clipCount, setClipCount] = useState(5);
  const [durationStyle, setDurationStyle] = useState("mixed"); // "short" | "mixed" | "medium"
  const [transcriptionProvider, setTranscriptionProvider] = useState("auto"); // "auto" | "groq" | "openai" | "deepgram" | "local"
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("hinglish"); // "hinglish" | "en" | "hi" | "auto"
  const [captionSplitMode, setCaptionSplitMode] = useState("smart"); // "smart" | "punchy"
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captionElapsedSec, setCaptionElapsedSec] = useState(0);
  const [captionProgressText, setCaptionProgressText] = useState("");
  const [appliedCaptionCount, setAppliedCaptionCount] = useState(null);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const captionTimerRef = useRef(null);

  const PIPELINE_STEPS = [
    { title: "Audio Extraction", desc: "Extracting source audio stream & wave data" },
    { title: "AI Speech-to-Text", desc: "Transcribing dialogue with word timestamps" },
    { title: "Viral Moment Scoring", desc: "Analyzing narrative hooks with AI" },
    { title: "9:16 Shorts Generation", desc: "Building vertical crop framing & subtitles" }
  ];

  // Auto-detect project status and load existing candidates on mount
  useEffect(() => {
    if (!project?._id && !project?.id) return;
    const pId = project._id || project.id;

    if (project?.status === "transcribing") {
      setRunningPipeline(true);
      setPipelineStep(2);
    } else if (project?.status === "analyzing") {
      setRunningPipeline(true);
      setPipelineStep(3);
    }

    // Fetch existing generated candidates
    api.get(`/api/projects/${pId}/pipeline-status`).then((res) => {
      const data = res.data?.data;
      if (data?.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
      }
    }).catch(() => {
      api.get(`/api/projects/${pId}`).then((res) => {
        const p = res.data?.data;
        if (p?.candidates && p.candidates.length > 0) {
          setCandidates(p.candidates);
        }
      }).catch(() => {});
    });
  }, [project?._id, project?.id, project?.status]);

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

  const [liveProgress, setLiveProgress] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [liveLogs, setLiveLogs] = useState([]);

  // Elapsed timer for Caption generator
  useEffect(() => {
    if (generatingCaptions) {
      setCaptionElapsedSec(0);
      captionTimerRef.current = setInterval(() => {
        setCaptionElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (captionTimerRef.current) clearInterval(captionTimerRef.current);
    }
    return () => {
      if (captionTimerRef.current) clearInterval(captionTimerRef.current);
    };
  }, [generatingCaptions]);

  // Real-time poller to sync live progress & server logs with UI
  useEffect(() => {
    if (!runningPipeline || (!project?._id && !project?.id)) return;
    const pId = project._id || project.id;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/projects/${pId}/pipeline-status`);
        const data = res.data?.data;
        if (data) {
          if (data.progress !== undefined) setLiveProgress(data.progress);
          if (data.message) setLiveMessage(data.message);
          if (data.logs) setLiveLogs(data.logs);

          if (data.stage === "extracting_audio" || data.stage === "downloading") {
            setPipelineStep(1);
          } else if (data.stage === "transcribing") {
            setPipelineStep(2);
          } else if (data.stage === "analyzing_moments" || data.stage === "analyzing") {
            setPipelineStep(3);
          } else if (data.stage === "rendering_shorts" || data.stage === "rendering" || data.stage === "completed") {
            setPipelineStep(4);
          }

          if (data.status === "completed" || (data.candidates && data.candidates.length > 0 && data.progress >= 95)) {
            if (data.candidates) setCandidates(data.candidates);
            setRunningPipeline(false);
          } else if (data.stage === "error" || (data.message && data.message.includes("failed"))) {
            setError(data.message);
            setRunningPipeline(false);
          }
        }
      } catch {
        // ignore transient poll error
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [runningPipeline, project?._id, project?.id]);

  const handleRunAutoPipeline = async () => {
    if (runningPipeline) return;
    let pipelineStarted = false;
    try {
      setRunningPipeline(true);
      setError(null);
      setPipelineStep(1);

      // Smooth step visual progression
      const stepTimer1 = setTimeout(() => setPipelineStep((s) => (s < 2 ? 2 : s)), 3000);
      const stepTimer2 = setTimeout(() => setPipelineStep((s) => (s < 3 ? 3 : s)), 12000);

      let storedKeys = {};
      try {
        const cached = localStorage.getItem("autoshorts_user_keys");
        if (cached) storedKeys = JSON.parse(cached);
      } catch {}

      const res = await api.post(`/api/projects/${project._id || project.id}/auto-pipeline`, {
        clipCount,
        durationStyle,
        transcriptionMode: transcriptionProvider,
        language: transcriptionLanguage,
        ...storedKeys
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      pipelineStarted = true;

      if (res.data?.data?.candidates) {
        setCandidates(res.data.data.candidates);
      } else if (res.data?.data) {
        setCandidates(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Pipeline execution failed");
      setPipelineStep(0);
    } finally {
      // The server runs this pipeline in the background. Keep polling until it
      // reports completion or an error, rather than hiding progress immediately.
      if (!pipelineStarted) setRunningPipeline(false);
    }
  };

  const handleGenerateWholeVideoCaptions = async () => {
    if (generatingCaptions) return;
    try {
      setGeneratingCaptions(true);
      setError(null);
      setCaptionProgressText("Transcribing speech from video...");

      let storedKeys = {};
      try {
        const cached = localStorage.getItem("autoshorts_user_keys");
        if (cached) storedKeys = JSON.parse(cached);
      } catch {}

      const res = await api.post(`/api/projects/${project._id || project.id}/transcribe`, {
        provider: transcriptionProvider,
        language: transcriptionLanguage,
        ...storedKeys
      });

      const transcriptData = res.data?.data;
      if (!transcriptData) {
        throw new Error("No transcription data returned from server");
      }

      setCaptionProgressText("Formatting subtitle timeline segments...");

      let formattedSegments = [];

      if (captionSplitMode === "punchy" && transcriptData.words && transcriptData.words.length > 0) {
        const words = transcriptData.words;
        const chunkSize = 4;
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize);
          const start = chunk[0].start || 0;
          const end = chunk[chunk.length - 1].end || (start + 1.2);
          const text = chunk.map((w) => w.text).join(" ");
          formattedSegments.push({
            id: `caption_${Date.now()}_${formattedSegments.length}`,
            start,
            end,
            text,
            fontId: captionStyle?.fontId || "default",
            style: captionStyle || {}
          });
        }
      } else if (transcriptData.segments && transcriptData.segments.length > 0) {
        formattedSegments = transcriptData.segments.map((seg, idx) => ({
          id: `caption_${Date.now()}_${idx}`,
          start: Number(seg.start) || 0,
          end: Number(seg.end) || 0,
          text: seg.text || "",
          fontId: captionStyle?.fontId || "default",
          style: captionStyle || {}
        }));
      } else if (transcriptData.words && transcriptData.words.length > 0) {
        formattedSegments = transcriptData.words.map((w, idx) => ({
          id: `caption_${Date.now()}_${idx}`,
          start: Number(w.start) || 0,
          end: Number(w.end) || 0,
          text: w.text || "",
          fontId: captionStyle?.fontId || "default",
          style: captionStyle || {}
        }));
      }

      if (formattedSegments.length === 0) {
        throw new Error("No spoken dialogue detected in this video.");
      }

      const fullText = formattedSegments.map((s) => s.text).join(" ");

      if (onApplyCaptions) {
        onApplyCaptions(formattedSegments, fullText);
      }

      setAppliedCaptionCount(formattedSegments.length);
      setCaptionProgressText("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to generate whole video captions");
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleDownloadClip = async (cand) => {
    const candidateId = cand._id || cand.id;
    if (!candidateId) return;

    const cleanTitle = (cand.title || `Short_${cand.rank || 1}`)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 40);
    const filename = `${cleanTitle}_9x16.mp4`;

    try {
      const res = await api.get(`/api/candidates/${candidateId}/download`, {
        responseType: "blob",
        timeout: 300000 // 5 min for large renders
      });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "video/mp4" }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError("Download failed: " + (err.response?.data?.message || err.message));
    }
  };

  const formatSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", color: "#f4f4f5", fontFamily: "sans-serif" }}>
      
      {/* Mode Switcher Tabs */}
      <div style={{
        display: "flex",
        background: "rgba(255, 255, 255, 0.05)",
        padding: "4px",
        borderRadius: "10px",
        gap: "4px",
        border: "1px solid rgba(255, 255, 255, 0.08)"
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("shorts")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "shorts" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
            color: activeTab === "shorts" ? "#ffffff" : "#a1a1aa",
            fontWeight: 600,
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <Sparkles size={14} />
          <span>AI Viral Shorts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("captions")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "captions" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
            color: activeTab === "captions" ? "#ffffff" : "#a1a1aa",
            fontWeight: 600,
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <Subtitles size={14} />
          <span>Whole Video Captions</span>
        </button>
      </div>

      {/* TAB 1: AI SHORTS GENERATOR */}
      {activeTab === "shorts" && (
        <div style={{
          padding: "16px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "#ffffff" }}>Generate Viral 9:16 Shorts</h3>
            </div>
            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", fontWeight: 600 }}>
              Auto Pipeline
            </span>
          </div>

          <p style={{ fontSize: "12px", color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
            Extract viral moments with narrative hooks, speaker tracking, and animated punchy captions in 9:16 vertical format.
          </p>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
            
            {/* Target Count Slider */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#a1a1aa" }}>
                <span>Target Shorts Count:</span>
                <strong style={{ color: "#8b5cf6" }}>{clipCount} Clips</strong>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={clipCount}
                disabled={runningPipeline}
                onChange={(e) => setClipCount(parseInt(e.target.value))}
                style={{ width: "100%", cursor: runningPipeline ? "not-allowed" : "pointer", accentColor: "#6366f1" }}
              />
            </div>

            {/* Duration Style */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Shorts Duration:</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {[
                  ["short", "15-30s", "Snappy"],
                  ["mixed", "30-60s", "Balanced"],
                  ["medium", "60-90s", "Detailed"]
                ].map(([id, time, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={runningPipeline}
                    onClick={() => setDurationStyle(id)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: durationStyle === id ? "1px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: durationStyle === id ? "rgba(139, 92, 246, 0.15)" : "rgba(0, 0, 0, 0.2)",
                      color: durationStyle === id ? "#c4b5fd" : "#a1a1aa",
                      fontSize: "11px",
                      cursor: runningPipeline ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px"
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{time}</span>
                    <span style={{ fontSize: "9px", opacity: 0.7 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language & Dialect Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Spoken Language / Script:</label>
              <select
                value={transcriptionLanguage}
                disabled={runningPipeline}
                onChange={(e) => setTranscriptionLanguage(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f4f4f5",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  outline: "none",
                  cursor: runningPipeline ? "not-allowed" : "pointer"
                }}
              >
                <option value="hinglish">ðŸ‡®ðŸ‡³ Hinglish (Hindi in English/Latin letters)</option>
                <option value="en">ðŸ‡ºðŸ‡¸ English</option>
                <option value="hi">ðŸ‡®ðŸ‡³ Hindi (Devanagari script)</option>
                <option value="auto">ðŸŒ Auto Detect Language</option>
              </select>
            </div>

            {/* AI Speech Engine Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Speech Recognition Engine:</label>
              <select
                value={transcriptionProvider}
                disabled={runningPipeline}
                onChange={(e) => setTranscriptionProvider(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f4f4f5",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  outline: "none",
                  cursor: runningPipeline ? "not-allowed" : "pointer"
                }}
              >
                <option value="auto">⚡ Auto Smart (Groq / OpenAI / Deepgram / Local)</option>
                <option value="groq">Groq Whisper (Ultra Fast, Large-v3)</option>
                <option value="openai">OpenAI Whisper Cloud</option>
                <option value="deepgram">Deepgram Nova-2</option>
                <option value="local">Local Whisper CLI</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleRunAutoPipeline}
              disabled={runningPipeline}
              className="btn-primary-gradient"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                borderRadius: "8px",
                cursor: runningPipeline ? "not-allowed" : "pointer",
                background: runningPipeline ? "rgba(99, 102, 241, 0.25)" : undefined,
                border: runningPipeline ? "1px solid rgba(99, 102, 241, 0.4)" : undefined,
                color: runningPipeline ? "#c4b5fd" : undefined,
                transition: "all 0.2s ease"
              }}
            >
              {runningPipeline ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  <span>Transcribing & Generating Shorts ({formatSec(elapsedSec)})...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{hasCaptions ? "Generate AI Shorts" : "Generate Captions & Shorts"}</span>
                </>
              )}
            </button>
          </div>

          {/* Active Pipeline Card */}
          {runningPipeline && (
            <div style={{
              marginTop: "8px",
              background: "rgba(0, 0, 0, 0.45)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              animation: "fadeIn 0.3s ease"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Radio size={14} color="#a855f7" className="spin" style={{ animation: "pulse 1.5s ease infinite" }} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#e9d5ff" }}>
                    AI Pipeline Active {liveProgress > 0 ? `(${liveProgress}%)` : ""}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#a1a1aa", background: "rgba(255, 255, 255, 0.06)", padding: "2px 6px", borderRadius: "4px" }}>
                  Elapsed: {formatSec(elapsedSec)}
                </span>
              </div>

              {/* Pulsing Progress Line */}
              <div style={{ height: "5px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(8, liveProgress || (pipelineStep * 25)))}%`,
                  background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
                  transition: "width 0.4s ease",
                  borderRadius: "999px"
                }} />
              </div>

              {/* Live status subtitle */}
              {liveMessage && (
                <div style={{
                  fontSize: "11px",
                  color: "#c084fc",
                  background: "rgba(192, 132, 252, 0.08)",
                  border: "1px solid rgba(192, 132, 252, 0.2)",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <Loader2 size={12} className="spin" />
                  <span>{liveMessage}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                {PIPELINE_STEPS.map((step, idx) => {
                  const stepNum = idx + 1;
                  const isDone = pipelineStep > stepNum;
                  const isCurrent = pipelineStep === stepNum;
                  return (
                    <div
                      key={step.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "11px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: isCurrent ? "rgba(139, 92, 246, 0.12)" : "transparent",
                        color: isCurrent ? "#ffffff" : isDone ? "#4ade80" : "#71717a"
                      }}
                    >
                      {isDone ? (
                        <CheckCircle2 size={15} color="#4ade80" />
                      ) : isCurrent ? (
                        <Loader2 size={15} color="#c084fc" style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <div style={{ width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #52525b" }} />
                      )}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: isCurrent ? 600 : 400, color: isCurrent ? "#ffffff" : isDone ? "#4ade80" : "#a1a1aa" }}>
                          {step.title} {isCurrent && <em style={{ fontSize: "10px", color: "#c084fc", fontStyle: "normal" }}>â€” in progress</em>}
                        </span>
                        <span style={{ fontSize: "10px", color: "#71717a" }}>{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Console Output Feed */}
              {liveLogs.length > 0 && (
                <div style={{
                  marginTop: "6px",
                  background: "#08090d",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  maxHeight: "100px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px"
                }}>
                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", fontWeight: 600, borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "3px", marginBottom: "2px" }}>
                    Live Server Activity Feed
                  </div>
                  {liveLogs.map((logLine, lIdx) => (
                    <div
                      key={lIdx}
                      style={{
                        fontFamily: "monospace",
                        fontSize: "10px",
                        lineHeight: 1.3,
                        color: logLine.includes("failed") || logLine.includes("error") ? "#f87171" : logLine.includes("complete") || logLine.includes("Complete") ? "#4ade80" : "#a1a1aa"
                      }}
                    >
                      {logLine}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHOLE VIDEO CAPTIONS GENERATOR */}
      {activeTab === "captions" && (
        <div style={{
          padding: "16px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Subtitles size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "#ffffff" }}>Full Video Auto-Captions</h3>
            </div>
            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontWeight: 600 }}>
              1-Click Apply
            </span>
          </div>

          <p style={{ fontSize: "12px", color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
            Transcribe the entire project audio and generate word-accurate timeline caption segments with customizable layout styles.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
            
            {/* Caption Format Style */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Subtitle Segmentation Style:</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {[
                  ["smart", "Sentence Chunks", "Natural reading flow"],
                  ["punchy", "Punchy Phrases", "3-4 words (Viral style)"]
                ].map(([id, title, desc]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={generatingCaptions}
                    onClick={() => setCaptionSplitMode(id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: captionSplitMode === id ? "1px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: captionSplitMode === id ? "rgba(139, 92, 246, 0.15)" : "rgba(0, 0, 0, 0.2)",
                      color: captionSplitMode === id ? "#c4b5fd" : "#a1a1aa",
                      fontSize: "11px",
                      cursor: generatingCaptions ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px"
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{title}</span>
                    <span style={{ fontSize: "9px", opacity: 0.7 }}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language & Dialect Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Spoken Language / Script:</label>
              <select
                value={transcriptionLanguage}
                disabled={generatingCaptions}
                onChange={(e) => setTranscriptionLanguage(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f4f4f5",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  outline: "none",
                  cursor: generatingCaptions ? "not-allowed" : "pointer"
                }}
              >
                <option value="hinglish">ðŸ‡®ðŸ‡³ Hinglish (Hindi in English/Latin letters)</option>
                <option value="en">ðŸ‡ºðŸ‡¸ English</option>
                <option value="hi">ðŸ‡®ðŸ‡³ Hindi (Devanagari script)</option>
                <option value="auto">ðŸŒ Auto Detect Language</option>
              </select>
            </div>

            {/* Speech Recognition Engine */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#a1a1aa" }}>Speech Recognition Engine:</label>
              <select
                value={transcriptionProvider}
                disabled={generatingCaptions}
                onChange={(e) => setTranscriptionProvider(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f4f4f5",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  outline: "none",
                  cursor: generatingCaptions ? "not-allowed" : "pointer"
                }}
              >
                <option value="auto">⚡ Auto Smart (Groq / OpenAI / Deepgram / Local)</option>
                <option value="groq">Groq Whisper (Ultra Fast, Large-v3)</option>
                <option value="openai">OpenAI Whisper Cloud</option>
                <option value="deepgram">Deepgram Nova-2</option>
                <option value="local">Local Whisper CLI</option>
              </select>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleGenerateWholeVideoCaptions}
              disabled={generatingCaptions}
              className="btn-primary-gradient"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                borderRadius: "8px",
                cursor: generatingCaptions ? "not-allowed" : "pointer",
                background: generatingCaptions ? "rgba(99, 102, 241, 0.25)" : undefined,
                border: generatingCaptions ? "1px solid rgba(99, 102, 241, 0.4)" : undefined,
                color: generatingCaptions ? "#c4b5fd" : undefined,
                transition: "all 0.2s ease"
              }}
            >
              {generatingCaptions ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  <span>{captionProgressText || "Transcribing Audio"} ({formatSec(captionElapsedSec)})...</span>
                </>
              ) : (
                <>
                  <Subtitles size={16} />
                  <span>Transcribe & Apply Captions to Timeline</span>
                </>
              )}
            </button>

            {appliedCaptionCount !== null && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "#4ade80",
                background: "rgba(74, 222, 128, 0.1)",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(74, 222, 128, 0.2)"
              }}>
                <Check size={14} />
                <span>Successfully generated and applied {appliedCaptionCount} captions to the timeline track!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: "12px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "8px",
          color: "#f87171",
          fontSize: "12px",
          lineHeight: 1.4,
          display: "flex",
          alignItems: "flex-start",
          gap: "8px"
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>{error}</div>
        </div>
      )}

      {/* Generated Candidates List */}
      {activeTab === "shorts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h4 style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", margin: "8px 0 0 0" }}>
            Detected Viral Moments ({candidates.length})
          </h4>

          {candidates.length === 0 ? (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#71717a",
              fontSize: "12px",
              border: "1px dashed rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px"
            }}>
              <Sparkles size={24} style={{ color: "#3f3f46" }} />
              <span>Click "Generate AI Shorts" to analyze your video and extract clips.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {candidates.map((candidate, idx) => {
                const start = Number(candidate.startSec ?? candidate.start) || 0;
                const end = Number(candidate.endSec ?? candidate.end) || (start + 30);
                const duration = (end - start).toFixed(1);
                const score = candidate.score || 85;

                return (
                  <div
                    key={candidate._id || idx}
                    style={{
                      padding: "14px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h5 style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff", margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {candidate.title || `Moment #${idx + 1}`}
                        </h5>
                        <p style={{ fontSize: "11px", color: "#71717a", margin: "4px 0 0 0" }}>
                          {start.toFixed(1)}s - {end.toFixed(1)}s ({duration}s duration)
                        </p>
                      </div>

                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 600,
                        background: "rgba(245, 158, 11, 0.1)",
                        color: "#fbbf24",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        height: "fit-content"
                      }}>
                        <Flame size={12} />
                        <span>{Math.round(score)}% Score</span>
                      </span>
                    </div>

                    {candidate.hook && (
                      <p style={{
                        fontSize: "11px",
                        color: "#e4e4e7",
                        fontStyle: "italic",
                        background: "rgba(0, 0, 0, 0.2)",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        margin: 0,
                        lineHeight: 1.4
                      }}>
                        "{candidate.hook}"
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadClip(candidate)}
                        className="btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: "11px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                          borderRadius: "6px",
                          color: "#34d399",
                          borderColor: "rgba(52, 211, 153, 0.25)"
                        }}
                        title="Download 9:16 Short MP4"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>

                      <button
                        onClick={() => onLoadMomentIntoTimeline({
                          start,
                          end,
                          title: candidate.title,
                          aspectRatio: "vertical",
                          rank: candidate.rank || index + 1
                        })}
                        className="btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: "11px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                          borderRadius: "6px"
                        }}
                      >
                        <span>Open on Timeline</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AiClipGeneratorPanel;
