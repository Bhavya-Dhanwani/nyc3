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
  Download
} from "lucide-react";

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running in standalone mode
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [captionStyle, setCaptionStyle] = useState("modern-box");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

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
        // The server uploads the finished file to Drive after the browser has
        // reached 100%, so this request must not use the short auth timeout.
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
      setError(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setCreating(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project?")) return;

    try {
      await api.delete(`/api/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => (p._id || p.id) !== projectId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete project");
    }
  };

  return (
    <div className="dashboard-root">
      {/* Top Navigation */}
      <header className="dashboard-nav">
        <div className="dashboard-brand">
          <div className="dashboard-logo">
            <img src="/katitor-logo-hd.png" alt="Katitor Logo" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#ffffff", lineHeight: 1.2 }}>Katitor Studio</div>
            <div style={{ fontSize: "11px", color: "var(--as-text-muted)" }}>AI Timeline Editor & Automation Platform</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isInstallable && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="btn-primary-gradient"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              <Download size={14} />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary"
          >
            <Settings size={14} />
            <span>Settings & AI Keys</span>
          </button>

          <div style={{ height: "18px", width: "1px", background: "var(--as-card-border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--as-text-secondary)" }}>
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
          <div>
            <h2 className="dashboard-hero-title">Projects Studio</h2>
            <p className="dashboard-hero-desc">
              Create video projects, run automated AI moment detection, and edit in the full timeline editor.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary-gradient"
          >
            <Plus size={16} />
            <span>New Video Project</span>
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div style={{ padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--as-text-muted)" }}>
            <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--as-accent-primary)" }} />
            <p style={{ fontSize: "13px" }}>Loading your projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            padding: "60px 24px",
            border: "1px dashed var(--as-card-border)",
            borderRadius: "var(--as-radius-lg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            background: "rgba(255, 255, 255, 0.01)"
          }}>
            <div style={{ width: "56px", height: "56px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Film size={26} color="var(--as-text-muted)" />
            </div>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#ffffff", margin: "0 0 6px 0" }}>No Projects Yet</h3>
            <p style={{ fontSize: "13px", color: "var(--as-text-muted)", maxWidth: "360px", margin: "0 0 18px 0" }}>
              Upload a long-form video to start generating AI short clips and editing on the timeline.
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
              return (
                <div
                  key={pId}
                  onClick={() => onOpenProject(project)}
                  className="project-card"
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {project.name || project.originalName || "Untitled Project"}
                      </h3>
                      <p style={{ fontSize: "11px", color: "var(--as-text-muted)", margin: "4px 0 0 0", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        <span>{project.sourceDuration ? `${project.sourceDuration.toFixed(1)}s` : "Video Project"}</span>
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteProject(pId, e)}
                      style={{ background: "transparent", border: "none", color: "var(--as-text-muted)", cursor: "pointer", padding: "4px", borderRadius: "4px" }}
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="project-card-thumb">
                    <Film size={32} />
                    <div className="project-card-thumb-overlay">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProject(project);
                        }}
                        style={{
                          padding: "8px 18px",
                          background: "var(--as-accent-primary)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                          pointerEvents: "auto",
                          zIndex: 10,
                          boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
                        }}
                      >
                        <span>Open in Editor</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--as-card-border)", fontSize: "11px", color: "var(--as-text-muted)" }}>
                    <span style={{ textTransform: "capitalize", padding: "2px 8px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.05)", color: "var(--as-text-secondary)" }}>
                      {project.status || "Ready"}
                    </span>

                    {project.driveFolderId && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#34d399" }}>
                        <Cloud size={12} />
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
                className="hover:bg-white/10 hover:text-white"
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
                          if (!projectName) {
                            setProjectName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                          }
                        }
                      }}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    />
                    <Upload size={24} style={{ color: "rgba(255, 255, 255, 0.4)", margin: "0 auto 12px auto" }} />
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                      {selectedFile ? selectedFile.name : "Click or drag video to upload"}
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", margin: "6px 0 0 0" }}>MP4, MOV, WEBM, MKV up to 2GB</p>
                  </div>
                </div>

                {creating && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--as-text-secondary)" }}>
                      <span>{uploadProgress === 100 ? "Syncing to Google Drive..." : "Uploading to server..."}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "999px", overflow: "hidden" }}>
                      <div
                        style={{ height: "100%", background: "var(--as-accent-primary)", width: `${uploadProgress}%`, transition: "width 0.2s ease" }}
                      />
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
                  disabled={creating}
                  className="btn-primary-gradient"
                >
                  {creating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
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
