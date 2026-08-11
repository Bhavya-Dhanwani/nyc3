import React, { useState, useEffect } from "react";
import api from "../lib/api.js";
import {
  Film,
  Plus,
  Trash2,
  Cloud,
  CheckCircle2,
  Loader2,
  Upload,
  Clock,
  ArrowRight,
  LogOut,
  Settings,
  X,
  Download,
  BarChart3,
  Calendar as CalendarIcon,
  Palette,
  Sparkles,
  Flame
} from "lucide-react";
import { BrandKitModal } from "./BrandKitModal.jsx";
import { AnalyticsModal } from "./AnalyticsModal.jsx";
import { ContentCalendarModal } from "./ContentCalendarModal.jsx";
import { getContentTypeConfig } from "../lib/contentTypes.js";

function formatDuration(seconds = 0) {
  if (!seconds) return "Video Project";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateString) {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function ProjectsDashboard({
  user,
  onOpenProject,
  onOpenSettings,
  onLogout
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [captionStyle, setCaptionStyle] = useState("modern-box");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setIsInstallable(false);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/projects");
      if (res.data?.data) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(err.response?.data?.message || err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a video file to upload");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const name = projectName.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
      const initResponse = await api.post("/api/projects/init-upload", { name, captionStyle });
      const projectId = initResponse.data?.data?._id || initResponse.data?.data?.id;
      if (!projectId) throw new Error("Could not initialize the project upload");

      const formData = new FormData();
      formData.append("media", selectedFile);

      const res = await api.post(`/api/projects/${projectId}/upload-media`, formData, {
        timeout: 0,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });

      if (res.data?.data) {
        setIsCreateModalOpen(false);
        setProjectName("");
        setSelectedFile(null);
        await loadProjects();
        onOpenProject(res.data.data);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      setError(err.response?.data?.message || err.message || "Failed to create project");
    } finally {
      setCreating(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await api.delete(`/api/projects/${id}`);
      setProjects((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert(err.response?.data?.message || "Failed to delete project");
    }
  };

  return (
    <div className="dashboard-container">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-logo-icon">
            <Film size={18} color="#ffffff" />
          </div>
          <div>
            <h1 className="dashboard-title">KATETOR</h1>
            <span className="dashboard-subtitle">AI Video Repurposing & Editor Studio</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="btn-secondary"
              style={{
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: "rgba(255, 255, 255, 0.05)"
              }}
            >
              <Download size={14} />
              <span>Install App</span>
            </button>
          )}

          {/* Quick Tool Navigation Buttons */}
          <button
            type="button"
            onClick={() => setIsBrandKitOpen(true)}
            className="btn-secondary"
            style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px" }}
            title="Brand Kit Settings"
          >
            <Palette size={14} color="#a855f7" />
            <span>Brand Kit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="btn-secondary"
            style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px" }}
            title="Content Calendar"
          >
            <CalendarIcon size={14} color="#ec4899" />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAnalyticsOpen(true)}
            className="btn-secondary"
            style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px" }}
            title="Studio Analytics"
          >
            <BarChart3 size={14} color="#10b981" />
            <span>Analytics</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="btn-secondary"
            style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px" }}
          >
            <Settings size={14} />
            <span>API Keys</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", paddingLeft: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>
              {user?.name || user?.email}
            </span>
            {user?.googleAccessToken && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 600,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.25)"
              }}>
                <CheckCircle2 size={11} />
                <span>Drive</span>
              </span>
            )}

            <button
              onClick={onLogout}
              className="btn-secondary"
              style={{ padding: "6px", borderRadius: "8px" }}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Dashboard Content */}
      <main className="dashboard-main">
        {/* Banner & Action Bar */}
        <div className="dashboard-hero-card">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h2 className="dashboard-hero-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>Projects Studio</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "9999px", background: "rgba(99, 102, 241, 0.2)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.4)", letterSpacing: "0.04em" }}>
                AI POWERED
              </span>
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--as-text-secondary)", background: "rgba(255, 255, 255, 0.05)", padding: "4px 12px", borderRadius: "9999px", border: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Film size={12} color="#ffffff" />
                <span>{projects.length} {projects.length === 1 ? "Project" : "Projects"}</span>
              </span>

              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--as-text-secondary)", background: "rgba(255, 255, 255, 0.05)", padding: "4px 12px", borderRadius: "9999px", border: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Cloud size={12} color="#34d399" />
                <span>Drive Sync Enabled</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary-gradient"
            style={{ padding: "12px 24px", fontSize: "13px", fontWeight: 700, borderRadius: "10px" }}
          >
            <Plus size={18} />
            <span>New Video Project</span>
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div style={{ padding: "80px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "var(--as-text-muted)" }}>
            <Loader2 size={36} style={{ animation: "spin 1s linear infinite", color: "#ffffff" }} />
            <p style={{ fontSize: "13px", fontWeight: 500 }}>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            padding: "80px 24px",
            border: "1px dashed rgba(255, 255, 255, 0.15)",
            borderRadius: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            background: "rgba(18, 18, 18, 0.5)"
          }}>
            <div style={{ width: "64px", height: "64px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
              <Film size={28} color="#ffffff" />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px 0" }}>No Projects Yet</h3>
            <p style={{ fontSize: "13px", color: "var(--as-text-muted)", maxWidth: "320px", margin: "0 0 20px 0" }}>
              Upload a long video to automatically detect viral clips and edit on the timeline.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary-gradient"
            >
              <Plus size={16} />
              <span>Create Your First Project</span>
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => {
              const pId = project._id || project.id;
              const isReady = (project.status || "").toLowerCase() === "ready";
              const candidates = Array.isArray(project.candidates) ? project.candidates : [];
              const viralCount = candidates.filter((c) => (c.contentType || "Viral").toLowerCase() === "viral").length;
              const eduCount = candidates.filter((c) => (c.contentType || "").toLowerCase() === "educational").length;
              const funnyCount = candidates.filter((c) => (c.contentType || "").toLowerCase() === "funny").length;

              return (
                <div
                  key={pId}
                  onClick={() => onOpenProject(project)}
                  className="project-card"
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {project.name || project.originalName || "Untitled Project"}
                      </h3>
                      <p style={{ fontSize: "11px", color: "var(--as-text-muted)", margin: "4px 0 0 0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={12} />
                        <span>{formatDuration(project.sourceDuration)}</span>
                        <span>•</span>
                        <span>{timeAgo(project.updatedAt)}</span>
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteProject(pId, e)}
                      style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "var(--as-text-muted)", cursor: "pointer", padding: "6px", borderRadius: "8px", transition: "all 0.2s ease" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.background = "rgba(244, 63, 94, 0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--as-text-muted)"; e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; }}
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Content Opportunity Badges */}
                  {candidates.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", margin: "4px 0" }}>
                      {viralCount > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
                          🔥 {viralCount} Viral
                        </span>
                      )}
                      {eduCount > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(234,179,8,0.15)", color: "#fde047", border: "1px solid rgba(234,179,8,0.3)" }}>
                          💡 {eduCount} Edu
                        </span>
                      )}
                      {funnyCount > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(236,72,153,0.15)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.3)" }}>
                          😂 {funnyCount} Funny
                        </span>
                      )}
                    </div>
                  )}

                  <div className="project-card-thumb">
                    <Film size={34} />
                    <div className="project-card-thumb-overlay">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProject(project);
                        }}
                        style={{
                          padding: "9px 20px",
                          background: "#ffffff",
                          color: "#000000",
                          border: "none",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          pointerEvents: "auto",
                          zIndex: 10,
                          boxShadow: "0 4px 14px rgba(0,0,0,0.6)"
                        }}
                      >
                        <span>Open Editor</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "11px" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      fontWeight: 600,
                      background: isReady ? "rgba(52, 211, 153, 0.12)" : "rgba(251, 191, 36, 0.12)",
                      color: isReady ? "#34d399" : "#fbbf24",
                      border: isReady ? "1px solid rgba(52, 211, 153, 0.25)" : "1px solid rgba(251, 191, 36, 0.25)"
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                      <span style={{ textTransform: "capitalize" }}>{project.status || "Ready"}</span>
                    </span>

                    {project.driveFolderId && (
                      <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#34d399", fontWeight: 600, fontSize: "10px", background: "rgba(52, 211, 153, 0.08)", padding: "3px 8px", borderRadius: "999px", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                        <Cloud size={11} />
                        <span>Drive Synced</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <BrandKitModal open={isBrandKitOpen} onClose={() => setIsBrandKitOpen(false)} />
      <AnalyticsModal open={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
      <ContentCalendarModal open={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} candidates={projects.flatMap((p) => p.candidates || [])} />

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="create-project-card">
            <div className="modal-header">
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: 0 }}>Create New Project</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={creating}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  transition: "all 0.2s ease"
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                {error && (
                  <div className="auth-error-banner">
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Project Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Podcast Episode #1"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Source Video</label>
                  <div className="project-upload-zone">
                    <input
                      type="file"
                      accept="video/*,audio/*"
                      required
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="project-upload-input"
                    />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", pointerEvents: "none" }}>
                      <Upload size={24} color="#ffffff" />
                      <span style={{ fontSize: "12px", color: "var(--as-text-secondary)" }}>
                        {selectedFile ? selectedFile.name : "Choose a video file or drop it here"}
                      </span>
                    </div>
                  </div>
                </div>

                {creating && uploadProgress > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--as-text-muted)", marginBottom: "4px" }}>
                      <span>Uploading media</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #6366f1, #a855f7)", transition: "width 0.2s ease" }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creating}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !selectedFile}
                  className="btn-primary-gradient"
                >
                  {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                  <span>{creating ? "Uploading..." : "Create Project"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsDashboard;
