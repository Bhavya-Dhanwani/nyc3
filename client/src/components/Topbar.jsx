import React from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  FileArrowDown,
  FileArrowUp,
  FilePlus,
  GearSix,
  Pause,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  FloppyDisk,
  House,
  Question,
  CloudCheck
} from "@phosphor-icons/react";

import { RATIO_OPTIONS } from "../config/editor.js";
import { APP_LANGUAGES, saveLanguagePreference } from "../i18n.js";
import { ExportSettingsPanel } from "./ExportSettingsPanel.jsx";
import { IconButton, Popover } from "./ui.jsx";

export function Topbar({
  t,
  compactRail,
  setCompactRail,
  lastSaved,
  undo,
  redo,
  ratio,
  ratioId,
  showRatioMenu,
  setShowRatioMenu,
  setRatioId,
  notify,
  isPlaying,
  handlePlayToggle,
  imageSrc,
  exporting,
  handleExportVideo,
  showExportMenu,
  setShowExportMenu,
  exportSettings,
  setExportSettings,
  timelineDuration,
  showSettings,
  setShowSettings,
  activeLanguage,
  setUiLanguage,
  captionsEnabled,
  setCaptionsEnabled,
  trackVisibility,
  toggleTrackVisibility,
  showFileMenu,
  setShowFileMenu,
  handleNewProject,
  handleExportProject,
  handleImportProject,
  projectFileInputRef,
  currentProject,
  onBackToDashboard,
  onSaveToBackend,
  isSavingToBackend,
  onOpenSettingsModal,
  onOpenTutorial,
}) {
  return (
    <header className="topbar">
      {/* Left Project & Breadcrumb Cluster */}
      <div className="project-cluster" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {onBackToDashboard && (
          <button
            type="button"
            className="ghost-action"
            onClick={onBackToDashboard}
            title={t("backToDashboard") === "backToDashboard" ? "Back to Dashboard" : t("backToDashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff"
            }}
          >
            <House size={15} weight="bold" />
            <span style={{ fontSize: "12px", letterSpacing: "0.5px" }}>Projects</span>
          </button>
        )}

        <IconButton label={t("collapseSidebar")} active={compactRail} onClick={() => setCompactRail((v) => !v)}>
          <SlidersHorizontal size={18} />
        </IconButton>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div className="project-title-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--as-text-muted)", fontSize: "12px" }}>/</span>
            <div className="project-title" style={{ fontWeight: 700, fontSize: "13px", color: "#ffffff" }}>
              {currentProject?.name || t("projectTitle")}
            </div>

            <div className="menu-anchor">
              <button
                className="project-file-button"
                type="button"
                onClick={() => setShowFileMenu((open) => !open)}
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                {t("fileMenu")} <CaretDown size={11} />
              </button>

              {showFileMenu ? (
                <Popover className="project-file-popover" closeLabel={t("close")} onClose={() => setShowFileMenu(false)}>
                  <div className="file-menu-card">
                    <div className="file-menu-heading">
                      <span>{t("projectMenuHeading")}</span>
                      <small>Duevora AutoShorts</small>
                    </div>
                    <button className="file-menu-action file-menu-new" type="button" onClick={handleNewProject}>
                      <span className="file-menu-icon"><FilePlus size={17} /></span>
                      <span className="file-menu-copy"><strong>{t("newProject")}</strong><small>{t("newProjectHint")}</small></span>
                    </button>
                    <div className="file-menu-divider" />
                    <button className="file-menu-action" type="button" onClick={() => handleImportProject()}>
                      <span className="file-menu-icon"><FileArrowUp size={17} /></span>
                      <span className="file-menu-copy"><strong>{t("importProject")}</strong><small>{t("importProjectHint")}</small></span>
                      <span className="file-menu-format">.timeline</span>
                    </button>
                    <button className="file-menu-action is-primary" type="button" onClick={handleExportProject}>
                      <span className="file-menu-icon"><FileArrowDown size={17} /></span>
                      <span className="file-menu-copy"><strong>{t("exportProject")}</strong><small>{t("exportProjectHint")}</small></span>
                      <span className="file-menu-format">.timeline</span>
                    </button>
                  </div>
                </Popover>
              ) : null}
              <input ref={projectFileInputRef} className="project-file-input" type="file" accept="application/zip,.timeline" onChange={(event) => event.target.files?.[0] && handleImportProject(event.target.files[0])} />
            </div>
          </div>

          <div className="autosave" style={{ fontSize: "10.5px", color: "var(--as-text-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
            <ShieldCheck size={12} weight="fill" color="#34d399" />
            <span>Saved {lastSaved}</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
              <CloudCheck size={12} weight="bold" /> Drive Ready
            </span>
          </div>
        </div>
      </div>

      {/* Center Ratio & Timeline Controls */}
      <div className="topbar-center" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button className="ghost-action" type="button" onClick={undo} title="Undo (Ctrl+Z)">
          <ArrowCounterClockwise size={15} />
          <span>{t("undo")}</span>
        </button>
        <button className="ghost-action" type="button" onClick={redo} title="Redo (Ctrl+Y)">
          <ArrowClockwise size={15} />
          <span>{t("redo")}</span>
        </button>

        <span className="divider" style={{ width: "1px", height: "18px", background: "rgba(255, 255, 255, 0.1)" }} />

        {/* Aspect Ratio Selector */}
        <div className="menu-anchor">
          <button
            className="ratio-select"
            type="button"
            onClick={() => setShowRatioMenu((open) => !open)}
            style={{
              padding: "5px 12px",
              borderRadius: "8px",
              background: "rgba(85, 70, 255, 0.12)",
              border: "1px solid rgba(85, 70, 255, 0.35)",
              color: "#c4b5fd",
              fontWeight: 700,
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>{ratio.label}</span>
            <CaretDown size={12} />
          </button>

          {showRatioMenu ? (
            <Popover closeLabel={t("close")} onClose={() => setShowRatioMenu(false)}>
              <div className="menu-list">
                {RATIO_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === ratioId ? "active" : ""}
                    type="button"
                    onClick={() => {
                      setRatioId(item.id);
                      setShowRatioMenu(false);
                      notify(`${t("ratioChanged")} ${item.label}`);
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{item.width} x {item.height}</small>
                  </button>
                ))}
              </div>
            </Popover>
          ) : null}
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onSaveToBackend && (
          <button
            className="ghost-action"
            type="button"
            onClick={onSaveToBackend}
            disabled={isSavingToBackend}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, fontSize: "12px" }}
          >
            <FloppyDisk size={15} />
            <span>{isSavingToBackend ? "Saving..." : "Save"}</span>
          </button>
        )}

        {/* Play / Pause Scrubber Bar */}
        <button
          className="play-toggle"
          type="button"
          onClick={handlePlayToggle}
          disabled={!imageSrc}
          style={{
            padding: "6px 14px",
            borderRadius: "10px",
            background: isPlaying ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.08)",
            border: isPlaying ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255, 255, 255, 0.15)",
            color: isPlaying ? "#f87171" : "#ffffff",
            fontWeight: 600,
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {isPlaying ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
          <span>{isPlaying ? t("pause") : t("play")}</span>
        </button>

        {/* Glow Export Button */}
        <div className="menu-anchor">
          <button
            className="export-trigger"
            type="button"
            onClick={() => setShowExportMenu((open) => !open)}
            disabled={exporting || !imageSrc}
            style={{
              padding: "7px 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #5546ff 0%, #7062ff 100%)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "12px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              boxShadow: "0 4px 20px -2px rgba(85, 70, 255, 0.5)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer"
            }}
          >
            <span>{exporting ? t("exporting") : t("export")}</span>
            <CaretDown size={12} />
          </button>

          {showExportMenu ? (
            <Popover className="export-settings-popover" closeLabel={t("close")} onClose={() => setShowExportMenu(false)}>
              <ExportSettingsPanel
                t={t}
                exporting={exporting}
                ratio={ratio}
                imageSrc={imageSrc}
                timelineDuration={timelineDuration}
                exportSettings={exportSettings}
                setExportSettings={setExportSettings}
                handleExportVideo={handleExportVideo}
                onClose={() => setShowExportMenu(false)}
              />
            </Popover>
          ) : null}
        </div>

        {onOpenTutorial && (
          <IconButton label="Tips & Tutorial" onClick={onOpenTutorial}>
            <Question size={18} />
          </IconButton>
        )}

        <IconButton
          label={t("settings")}
          active={showSettings}
          onClick={() => {
            if (onOpenSettingsModal) onOpenSettingsModal();
            else setShowSettings((open) => !open);
          }}
        >
          <GearSix size={18} />
        </IconButton>

        {!onOpenSettingsModal && showSettings ? (
          <Popover closeLabel={t("close")} onClose={() => setShowSettings(false)}>
            <div className="settings-panel">
              <strong>{t("exportSettings")}</strong>
              <label>
                <span>{t("language")}</span>
                <select
                  value={activeLanguage}
                  onChange={(event) => {
                    const nextLanguage = event.target.value;
                    saveLanguagePreference(nextLanguage);
                    setUiLanguage(nextLanguage);
                  }}
                >
                  {APP_LANGUAGES.map((language) => (
                    <option value={language.id} key={language.id}>
                      {language.nativeName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={captionsEnabled}
                  onChange={(event) => setCaptionsEnabled(event.target.checked)}
                />
                {t("exportCaptions")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={trackVisibility.audio}
                  onChange={() => toggleTrackVisibility("audio")}
                />
                {t("enableAudioTrack")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={trackVisibility.source}
                  onChange={() => toggleTrackVisibility("source")}
                />
                {t("enableSourceTrack")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={trackVisibility.music}
                  onChange={() => toggleTrackVisibility("music")}
                />
                {t("enableMusicTrack")}
              </label>
              <button type="button" onClick={() => notify(t("checkModelCacheHint"))}>
                {t("checkModelCache")}
              </button>
            </div>
          </Popover>
        ) : null}
      </div>
    </header>
  );
}

export default Topbar;
