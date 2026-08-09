import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Search,
  Sparkles,
  Play,
  FileVideo,
  AlertCircle
} from "lucide-react";
import { logo } from "../features/landing/duevora/assets";

export function ProjectsDashboard({
  user,
  onOpenProject,
  onOpenSettings,
  onLogout
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [captionStyle, setCaptionStyle] = useState("modern-box");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleCreateProject = async (fileToUpload = selectedFile, customName = projectName) => {
    const file = fileToUpload || selectedFile;
    if (!file) {
      setError("Please select a video file to upload");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const name = (customName || projectName).trim() || file.name.replace(/\.[^/.]+$/, "");
      const initResponse = await api.post("/api/projects/init-upload", { name, captionStyle });
      const projectId = initResponse.data?.data?._id || initResponse.data?.data?.id;
      if (!projectId) throw new Error("Could not initialize the project upload");

      const formData = new FormData();
      formData.append("media", file);

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

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setProjectName(file.name.replace(/\.[^/.]+$/, ""));
        setIsCreateModalOpen(true);
      } else {
        setError("Please drop a valid video file (MP4, MOV, WEBM)");
      }
    }
  };

  const filteredProjects = projects.filter((p) => {
    const name = (p.name || p.originalName || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const isDriveConnected = !!user?.googleAccessToken;

  return (
    <div
      className="min-h-screen w-full bg-[#08090d] text-white flex flex-col font-helveticaNeue"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDraggingOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Full-Screen Drag-and-Drop Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0e1017]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 border-4 border-dashed border-[#5546ff] text-center pointer-events-none"
          >
            <Upload size={54} className="text-[#5546ff] animate-bounce mb-4" />
            <h2 className="text-3xl font-bold font-helveticaNeue text-white tracking-tight">
              Drop Video to Create Project
            </h2>
            <p className="text-xs uppercase tracking-widest text-white/70 mt-2 font-medium">
              MP4, MOV, WEBM auto-ingest
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full h-16 bg-[#0c0d14] border-b border-white/10 px-6 sm:px-10 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Duevora"
            width={34}
            height={34}
            className="brightness-125"
          />
          <div className="flex flex-col">
            <span className="font-bold text-base leading-tight tracking-tight text-white">
              Duevora Studio
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/50 font-medium">
              AI Video & Short-Form Automation
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Cloud Storage Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <Cloud size={14} className={isDriveConnected ? "text-emerald-400" : "text-white/40"} />
            <span className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">
              {isDriveConnected ? "Drive: Synced" : "Local Storage"}
            </span>
            {isDriveConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </div>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold uppercase tracking-wider text-white transition-colors cursor-pointer"
            title="Configure AI API Keys & Cloud Settings"
          >
            <Settings size={13} />
            <span>Settings</span>
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold uppercase">
              {user?.name?.[0] || user?.email?.[0] || "U"}
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Banner Card */}
        <section className="w-full rounded-2xl p-6 sm:p-8 bg-[#0f1118] border border-white/10 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="max-w-xl flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
                Workspace Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-helveticaNeue tracking-tight text-white">
              Projects & AI Shorts
            </h1>
            <p className="text-xs sm:text-sm text-white/60 font-normal leading-relaxed">
              Upload long-form footage to detect viral hooks, generate auto-subtitles, and assemble multi-track 9:16 Shorts with Google Drive sync.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-neutral-100 text-black font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Plus size={16} className="text-black stroke-[3]" />
              <span className="text-black font-bold">New Video Project</span>
            </button>
          </div>
        </section>

        {/* Quick Search & Count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-[#0e1017] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder-white/30 outline-none transition-colors"
            />
          </div>

          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">
            <span>{filteredProjects.length} Project{filteredProjects.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Projects Grid / Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-white/50">
            <Loader2 size={30} className="animate-spin text-[#5546ff]" />
            <p className="text-xs uppercase tracking-wider">Loading your projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            onClick={() => setIsCreateModalOpen(true)}
            className="py-16 px-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/20 bg-[#0e1017] transition-all flex flex-col items-center justify-center text-center cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3.5 text-white/60">
              <Upload size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {searchQuery ? "No matching projects found" : "No video projects yet"}
            </h3>
            <p className="text-xs text-white/50 max-w-sm mb-5 leading-relaxed">
              Drag & drop any video file here or click to create your first project.
            </p>
            <button
              type="button"
              className="px-5 py-2.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md cursor-pointer hover:bg-neutral-100"
            >
              <Plus size={14} className="text-black stroke-[3]" />
              <span className="text-black">Upload Video</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const pId = project._id || project.id;
              const durationFormatted = project.sourceDuration
                ? `${Math.floor(project.sourceDuration / 60)}:${String(Math.floor(project.sourceDuration % 60)).padStart(2, "0")}`
                : null;

              return (
                <div
                  key={pId}
                  onClick={() => onOpenProject(project)}
                  className="group bg-[#0e1017] hover:bg-[#12141e] border border-white/10 hover:border-white/25 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all shadow-md cursor-pointer relative"
                >
                  {/* Thumbnail / Header Frame */}
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                    <Film size={32} className="text-white/20 group-hover:scale-105 transition-transform" />

                    {/* Play Badge on Hover */}
                    <div className="absolute z-20 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                      <Play size={16} className="fill-black ml-0.5" />
                    </div>

                    {/* Duration Badge */}
                    {durationFormatted && (
                      <span className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white font-semibold border border-white/10">
                        {durationFormatted}
                      </span>
                    )}

                    {/* Status Pill */}
                    <span className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-white/10 backdrop-blur-md text-[10px] uppercase font-bold tracking-wider text-white border border-white/15">
                      {project.status || "Ready"}
                    </span>
                  </div>

                  {/* Project Info */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-white group-hover:text-white transition-colors line-clamp-1">
                        {project.name || project.originalName || "Untitled Project"}
                      </h3>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(pId, e)}
                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <p className="text-[11px] text-white/40 flex items-center gap-1.5">
                      <Clock size={11} />
                      <span>{new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleDateString()}</span>
                    </p>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-white/60 group-hover:text-white">
                    <span className="uppercase tracking-wider text-[11px]">Open In Editor</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Project Creation Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              if (!creating) setIsCreateModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0e1017] border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
                    <FileVideo size={16} />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    New Video Project
                  </h3>
                </div>
                {!creating && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateProject();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/70 font-semibold mb-1.5">
                    Project Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Podcast Ep 12 Viral Hooks"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full h-10 px-3.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder-white/30 outline-none"
                  />
                </div>

                {/* File Drop Area */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/70 font-semibold mb-1.5">
                    Source Video File
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!projectName) {
                          setProjectName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-white/15 hover:border-white/30 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] text-center cursor-pointer transition-colors"
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2.5 text-white">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span className="text-xs font-semibold truncate max-w-[240px]">
                          {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-white/40">
                          ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} className="text-white/50" />
                        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                          Choose Video File or Drop Here
                        </span>
                        <span className="text-[10px] text-white/40">MP4, MOV, WEBM</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Progress */}
                {creating && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs text-white/70">
                      <span>Uploading video...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 flex justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold uppercase tracking-wider text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !selectedFile}
                    className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-xs font-bold uppercase tracking-wider text-black transition-colors flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    {creating ? <Loader2 size={13} className="animate-spin text-black" /> : <Plus size={13} className="text-black stroke-[3]" />}
                    <span className="text-black font-bold">{creating ? "Uploading..." : "Create Project"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProjectsDashboard;
