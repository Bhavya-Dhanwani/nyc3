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
} from "@phosphor-icons/react";

import { RATIO_OPTIONS } from "../config/editor.js";
import { APP_LANGUAGES, saveLanguagePreference } from "../i18n.js";
import { ExportSettingsPanel } from "./ExportSettingsPanel.jsx";
import { IconButton, Popover } from "./ui.jsx";
import { GlobalActivityPill, GlobalActivityDrawer } from "./GlobalActivityDrawer.jsx";
import { useState } from "react";

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
  canExportVideo = Boolean(imageSrc),
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
  showContentMap,
  onToggleContentMap,
  onResetLayout,
  editorLayout,
  activeOperations = [],
  operationHistory = [],
  onCancelOperation,
  onRetryOperation
}) {
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="project-cluster">
        {onBackToDashboard && (
          <button
            type="button"
            className="ghost-action"
            onClick={onBackToDashboard}
            title={t("backToDashboard") === "backToDashboard" ? "Back to Dashboard" : t("backToDashboard")}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
          >
            <House size={16} />
            <span>{t("dashboard") === "dashboard" ? "Dashboard" : t("dashboard")}</span>
          </button>
        )}
        <IconButton label={t("collapseSidebar")} active={compactRail} onClick={() => setCompactRail((v) => !v)}>
          <SlidersHorizontal size={19} />
        </IconButton>
        <div>
          <div className="project-title-row">
            <div className="project-title">{currentProject?.name || t("projectTitle")}</div>
            <div className="menu-anchor">
              <button className="project-file-button" type="button" onClick={() => setShowFileMenu((open) => !open)}>
                {t("fileMenu")} <CaretDown size={13} />
              </button>
              {showFileMenu ? (
                <Popover className="project-file-popover" closeLabel={t("close")} onClose={() => setShowFileMenu(false)}>
                  <div className="file-menu-card">
                    <div className="file-menu-heading">
                      <span>{t("projectMenuHeading")}</span>
                      <small>Katitor Studio</small>
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
          <div className="autosave">
            <ShieldCheck size={13} weight="fill" />
            {t("autosave")} · {lastSaved}
          </div>
        </div>
      </div>

      <div className="topbar-center">
        <button className="ghost-action" type="button" onClick={undo}>
          <ArrowCounterClockwise size={16} />
          {t("undo")}
        </button>
        <button className="ghost-action" type="button" onClick={redo}>
          <ArrowClockwise size={16} />
          {t("redo")}
        </button>
        {onResetLayout && (
          <button
            className="ghost-action"
            type="button"
            onClick={() => {
              onResetLayout();
              notify?.("Layout reset to default");
            }}
            title={t("resetLayout", "Reset Layout")}
          >
            <SlidersHorizontal size={15} />
            <span>{t("resetLayout", "Reset Layout")}</span>
          </button>
        )}
        <span className="divider" />
        <div className="menu-anchor">
          <button
            className="ratio-select"
            type="button"
            onClick={() => setShowRatioMenu((open) => !open)}
          >
            {ratio.label} <CaretDown size={14} />
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

      <div className="topbar-actions">
        {/* Real-time Global Activity & Drive Save Indicator */}
        <GlobalActivityPill
          activeOperations={activeOperations}
          operationHistory={operationHistory}
          isOpen={isActivityDrawerOpen}
          onToggle={() => setIsActivityDrawerOpen((v) => !v)}
          saveStatus={isSavingToBackend ? "saving" : "saved"}
        />

        {onToggleContentMap && (
          <button
            type="button"
            className={`layout-pill-btn ${showContentMap ? "is-active" : ""}`}
            onClick={onToggleContentMap}
            title="Toggle Visual Content Map"
            style={{
              padding: "5px 12px",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              borderRadius: "999px",
              background: showContentMap ? "linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))" : "rgba(255, 255, 255, 0.05)",
              border: showContentMap ? "1px solid #818cf8" : "1px solid rgba(255, 255, 255, 0.1)",
              color: showContentMap ? "#ffffff" : "#cbd5e1",
              cursor: "pointer"
            }}
          >
            <span>⚡ Content Map</span>
          </button>
        )}

        {onSaveToBackend && (
          <button
            className="ghost-action"
            type="button"
            onClick={onSaveToBackend}
            disabled={isSavingToBackend}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
          >
            <FloppyDisk size={16} />
            <span>{isSavingToBackend ? (t("saving") === "saving" ? "Saving..." : t("saving")) : (t("saveProject") === "saveProject" ? "Save Project" : t("saveProject"))}</span>
          </button>
        )}

        <button className="play-toggle" type="button" onClick={handlePlayToggle} disabled={!imageSrc}>
          {isPlaying ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}
          <span>{isPlaying ? t("pause") : t("play")}</span>
        </button>

        <div className="menu-anchor">
          <button
            className="export-trigger"
            type="button"
            onClick={() => setShowExportMenu((open) => !open)}
            disabled={exporting || !canExportVideo}
          >
            {exporting ? t("exporting") : t("export")}
            <CaretDown size={13} />
          </button>
          {showExportMenu ? (
            <Popover className="export-settings-popover" closeLabel={t("close")} onClose={() => setShowExportMenu(false)}>
              <ExportSettingsPanel
                t={t}
                exporting={exporting}
                ratio={ratio}
                imageSrc={imageSrc}
                canExportVideo={canExportVideo}
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
          <IconButton
            label="Tips & Tutorial"
            onClick={onOpenTutorial}
          >
            <Question size={19} />
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
          <GearSix size={19} />
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

      <GlobalActivityDrawer
        isOpen={isActivityDrawerOpen}
        onClose={() => setIsActivityDrawerOpen(false)}
        activeOperations={activeOperations}
        operationHistory={operationHistory}
        onCancelOperation={onCancelOperation}
        onRetryOperation={onRetryOperation}
      />
    </header>
  );
}
