import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { getGoogleToken } from "../lib/googleDriveClient.js";
import axios from "axios";
import { Plus, Cloud, Loader2, Sparkles } from "lucide-react";
import { AiClipGeneratorPanel } from "./AiClipGeneratorPanel.jsx";
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CloudArrowUp,
  ClosedCaptioning,
  Diamond,
  DownloadSimple,
  FrameCorners,
  MicrophoneStage,
  MusicNote,
  MagicWand,
  Pause,
  PlayCircle,
  PersonSimpleRun,
  Scan,
  Scissors,
  Trash,
  Waveform,
  X,
} from "@phosphor-icons/react";

import {
  FILTER_OPTIONS,
  SAMPLE_IMAGE,
  STICKERS,
  STICKER_CATEGORIES,
  STICKER_PAGE_SIZE,
  VOICES,
} from "../config/editor.js";
import { APP_LANGUAGES } from "../i18n.js";
import { AI_MUSIC_PRESETS, buildEnglishMusicPrompt } from "../lib/aiMusicPrompt.js";
import {
  ensureCaptionFontLoaded,
  getCaptionFont,
  getCaptionFontsForLanguage,
} from "../lib/captionFonts.js";
import {
  detectGeminiNanoVectorSupport,
  generateVectorWithGeminiNano,
} from "../lib/geminiNanoVector.js";
import { getRemoteAssetBlob } from "../lib/remoteAssetCache.js";
import { downloadBlob as downloadMediaBlob } from "../lib/media.js";
import { formatClock, formatTime, getSegmentStartTime } from "../lib/timeline.js";
import { VECTOR_CATEGORIES } from "../lib/vectorAssets.js";
import { hasVisualPropertyKeyframe, normalizeVisualKeyframes, resolveVisualTransform } from "../lib/visualEffects.js";
import { DEFAULT_VISUAL_ANIMATION_DURATION, normalizeVisualClipAnimation, VISUAL_CLIP_ANIMATION_OPTIONS } from "../lib/visualClipAnimations.js";
import { getVisualPropertyTabIds } from "../lib/visualPropertyTabs.js";
import { Popover } from "./ui.jsx";
import { SubjectEffectsWorkspace } from "./SubjectEffectsPanel.jsx";
import { convertVoiceBlob, extractVoiceEmbedding } from "../lib/openVoiceRuntime.js";
import { getVoiceCloneTestSentence, synthesizeBaseVoice } from "../lib/baseVoiceSynthesis.js";

export function LanguageIntro({ t, closing, onChoose }) {
  return (
    <div className={`language-intro ${closing ? "is-closing" : ""}`} role="dialog" aria-modal="true">
      <div className="language-intro-card">
        <div className="language-intro-preview" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="language-intro-heading">
          <p>{t("languageKicker")}</p>
          <a
            className="language-intro-badge"
            href="https://toolindex.net/tools/timeline-studio?ref=badge"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Timeline Studio â€” Top 10 Video on Tool Index (opens in a new tab)"
          >
            <img
              src="https://toolindex.net/badge/timeline-studio/score.svg"
              alt="Timeline Studio - Top 10 Video on Tool Index"
              width="200"
              height="60"
            />
          </a>
        </div>
        <h1>
          <span className="language-title-en">Choose interface language</span>
          <span className="language-title-local">{t("languageTitle")}</span>
        </h1>
        <span className="language-intro-copy">
          <strong>Pick a language. This choice will be saved for next time.</strong>
          <span>{t("languageSubtitle")}</span>
        </span>
        <div className="language-grid">
          {APP_LANGUAGES.map((language) => (
            <button type="button" key={language.id} onClick={() => onChoose(language.id)}>
              <strong>{language.nativeName}</strong>
              <span>{language.hint}</span>
            </button>
          ))}
        </div>
        <small>{t("languageSaved")}</small>
      </div>
    </div>
  );
}

export function MediaPanel({
  t,
  mediaTab,
  setMediaTab,
  driveFiles = [],
  isDragging,
  setIsDragging,
  fileInputRef,
  handleFiles,
  selectedLibraryAssetId,
  builtInAssets,
  libraryType,
  libraryQuery,
  setLibraryQuery,
  selectLibraryType,
  libraryStatus,
  libraryError,
  libraryProvider,
  assetDownloadStates,
  prefetchLibraryAsset,
  userAssets,
  deleteUserAsset,
  draggedAssetId,
  handleAssetPointerDown,
  handleAssetClick,
  applyAssetToTrack,
  closeMobilePanel,
  mobilePanelOpen,
  language = "en",
  onGeneratedVector,
  onOpenAiMusic,
}) {
  const assets = mediaTab === "library" ? builtInAssets : userAssets;
  const [vectorCategory, setVectorCategory] = useState("all");
  const [downloadingDriveFileId, setDownloadingDriveFileId] = useState(null);

  const handleDriveFileClick = async (df) => {
    if (downloadingDriveFileId) return;
    try {
      setDownloadingDriveFileId(df.id);
      const isSrt = df.name?.toLowerCase().endsWith(".srt") || df.name?.toLowerCase().endsWith(".vtt");
      let fileBlob;
      const token = getGoogleToken();

      if (token) {
        const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob"
        });
        fileBlob = res.data;
      } else {
        const currentPId = (typeof window !== "undefined" && window.location.pathname.split("/").pop()) || "";
        const res = await api.get(`/api/projects/${currentPId}/drive-files/${df.id}/content`, {
          responseType: "blob"
        });
        fileBlob = res.data;
      }

      const file = new File([fileBlob], df.name, { type: isSrt ? "application/x-subrip" : (df.mimeType || "application/octet-stream") });
      await handleFiles([file]);
      if (!isSrt) {
        setMediaTab("upload");
      }
    } catch (err) {
      console.error("Failed to download Google Drive file:", err);
      alert("Failed to retrieve file from Google Drive: " + (err.response?.data?.message || err.message || err));
    } finally {
      setDownloadingDriveFileId(null);
    }
  };
  const visibleAssets = libraryType === "vector" && vectorCategory !== "all"
    ? assets.filter((asset) => asset.category === vectorCategory)
    : assets;
  const selectedAsset = [...userAssets, ...builtInAssets].find((asset) => asset.id === selectedLibraryAssetId) ?? null;
  const assetIntentTimerRef = useRef(null);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [aiVectorOpen, setAiVectorOpen] = useState(false);

  useEffect(() => {
    if (!previewAsset) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPreviewAsset(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewAsset]);

  const openAssetPreview = (event, asset) => {
    handleAssetClick(event, asset);
    if (window.matchMedia?.("(max-width: 760px)").matches) return;
    if (!event.defaultPrevented) setPreviewAsset(asset);
  };
  const addSelectedAsset = async (track) => {
    if (!selectedAsset) return;
    await applyAssetToTrack?.(selectedAsset, track);
    closeMobilePanel?.();
  };
  const renderAssetList = (items, { deletable = false, prepend = null } = {}) => (
    <div
      className={`asset-list ${mediaTab === "upload" ? "upload-assets" : ""}`}
      aria-label={libraryStatus === "loading" && mediaTab === "library" ? t("libraryLoading") : undefined}
      aria-busy={libraryStatus === "loading" && mediaTab === "library" ? "true" : undefined}
    >
      {prepend}
      {libraryStatus === "loading" && mediaTab === "library" ? (
        <LibraryLoadingGrid />
      ) : items.length ? (
        items.map((asset) => (
          <div
            className={`asset-row-wrap ${draggedAssetId === asset.id ? "is-dragging" : ""}`}
            key={asset.id}
          >
            <button
              type="button"
              className="asset-row-button"
              onPointerDown={(event) => handleAssetPointerDown(event, asset)}
              onPointerEnter={() => {
                if (mediaTab !== "library") return;
                clearTimeout(assetIntentTimerRef.current);
                assetIntentTimerRef.current = setTimeout(() => void prefetchLibraryAsset?.(asset), 180);
              }}
              onPointerLeave={() => clearTimeout(assetIntentTimerRef.current)}
              onClick={(event) => openAssetPreview(event, asset)}
            >
              <AssetRow asset={asset} selected={asset.id === selectedLibraryAssetId} t={t} downloadState={assetDownloadStates?.[asset.id]} />
            </button>
            {deletable ? (
              <button
                className="asset-delete"
                type="button"
                aria-label={t("deleteAsset")}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteUserAsset(asset);
                }}
              >
                <Trash size={15} />
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <div className="empty-state">{mediaTab === "library" ? (libraryError || t("libraryEmpty")) : t("emptyAssets")}</div>
      )}
    </div>
  );

  return (
    <>
      <div className="tabs">
        {[
          ["upload", t("uploadTab")],
          ["gdrive", "Google Drive"],
          ["library", t("libraryTab")],
          ["mine", t("mineTab")],
        ].map(([id, label]) => (
          <button className={mediaTab === id ? "is-active" : ""} type="button" key={id} onClick={() => setMediaTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {mediaTab === "gdrive" ? (
        <div style={{ padding: "12px 0" }}>
          <h4 style={{ fontSize: "12px", color: "#34d399", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Cloud size={16} />
            <span>Google Drive Folder Media</span>
          </h4>
          
          {driveFiles.length === 0 ? (
            <div className="empty-state">No files found in project's Drive folder</div>
          ) : (
            <div className="asset-list upload-assets">
              {driveFiles.map((df) => (
                <div className="asset-row-wrap" key={df.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", marginBottom: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: "8px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 500, margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: "#e4e4e7" }}>{df.name}</p>
                    <p style={{ fontSize: "10px", color: df.name?.toLowerCase().endsWith(".srt") ? "#38bdf8" : "#a1a1aa", margin: "2px 0 0 0" }}>
                      {df.name?.toLowerCase().endsWith(".srt") ? "SRT Subtitles" : (df.mimeType?.split("/")[1] || "media")}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleDriveFileClick(df)}
                    disabled={downloadingDriveFileId !== null}
                    style={{
                      padding: "6px 10px",
                      background: "rgba(16, 185, 129, 0.2)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      borderRadius: "6px",
                      color: "#34d399",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {downloadingDriveFileId === df.id ? (
                      <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Plus size={14} />
                    )}
                    <span>Import</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : mediaTab === "upload" ? (
        <>
          <button
            className={`drop-zone ${isDragging ? "is-dragging" : ""}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
          >
            <CloudArrowUp size={42} />
            <strong>{t("uploadDropTitle")}</strong>
            <span>{t("uploadSupport")}</span>
          </button>
          {renderAssetList(userAssets, { deletable: true })}
        </>
      ) : mediaTab === "library" ? (
        <>
          <LibraryTypeTabs t={t} activeType={libraryType} onSelect={selectLibraryType} />
          <form className="library-search" onSubmit={(event) => event.preventDefault()}>
            <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder={t(libraryType === "vector" ? "librarySearchVectorPlaceholder" : libraryType === "audio" ? "librarySearchMusicPlaceholder" : "librarySearchPlaceholder")} aria-label={t(libraryType === "vector" ? "librarySearchVectorPlaceholder" : libraryType === "audio" ? "librarySearchMusicPlaceholder" : "librarySearchPlaceholder")} />
          </form>
          {libraryType === "vector" ? (
            <div className="vector-category-row" role="group" aria-label={t("vectorCategories", "çŸ¢é‡ç´ æåˆ†ç±»")}>
              {VECTOR_CATEGORIES.map((category) => (
                <button
                  type="button"
                  className={vectorCategory === category.id ? "is-active" : ""}
                  aria-pressed={vectorCategory === category.id}
                  key={category.id}
                  onClick={() => setVectorCategory(category.id)}
                >
                  {t(category.labelKey, category.fallback)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="library-provider">{t("libraryProvidedBy")} <strong>{libraryProvider}</strong></div>
          {renderAssetList(visibleAssets, {
            prepend: libraryType === "audio" ? (
              <AiMusicLibraryCard
                language={language}
                onClick={onOpenAiMusic}
              />
            ) : libraryType === "vector" && vectorCategory === "all" ? (
              <AiVectorDesignCard
                language={language}
                onClick={() => setAiVectorOpen(true)}
              />
            ) : null,
          })}
        </>
      ) : (
        renderAssetList(assets, { deletable: mediaTab === "mine" })
      )}

      {selectedAsset && mobilePanelOpen ? createPortal((
        <div className="mobile-asset-actions" aria-label={t("mobileAssetActions")}>
          <span><strong>{selectedAsset.name}</strong><small>{t("mobileAssetSelected")}</small></span>
          {selectedAsset.type === "audio" ? (
            <div>
              <button type="button" className="is-secondary" onClick={() => void addSelectedAsset("music")}>{t("mobileAddToMusic")}</button>
              <button type="button" onClick={() => void addSelectedAsset("audio")}>{t("mobileAddToVoice")}</button>
            </div>
          ) : (
            <div>
              <button type="button" className="is-secondary" onClick={() => void addSelectedAsset("overlay")}>{t("dropAsOverlay")}</button>
              <button type="button" onClick={() => void addSelectedAsset("image")}>{t("mobileAddToMainTrack")}</button>
            </div>
          )}
        </div>
      ), document.body) : null}

      {previewAsset ? createPortal(
        <AssetPreviewDialog asset={previewAsset} t={t} onClose={() => setPreviewAsset(null)} />,
        document.body,
      ) : null}

      {aiVectorOpen ? createPortal(
        <AiVectorDesignDialog
          language={language}
          onClose={() => setAiVectorOpen(false)}
          onGenerated={(asset) => {
            onGeneratedVector?.(asset);
            setAiVectorOpen(false);
          }}
        />,
        document.body,
      ) : null}
    </>
  );
}

const AI_VECTOR_COPY = {
  zh: {
    cardTitle: "AI è®¾è®¡",
    cardHint: "Gemini Nano Â· æµè§ˆå™¨æœ¬åœ°ç”Ÿæˆ",
    cardMeta: "æè¿°éœ€æ±‚ï¼Œç”Ÿæˆå¯ç¼–è¾‘ SVG",
    kicker: "æœ¬åœ° AI çŸ¢é‡è®¾è®¡",
    title: "ç”¨ Gemini Nano è®¾è®¡çŸ¢é‡å›¾",
    intro: "æè¿°ä½ éœ€è¦çš„å›¾å½¢ã€‚æç¤ºè¯ä¸Žç”Ÿæˆè¿‡ç¨‹éƒ½ç•™åœ¨æµè§ˆå™¨ä¸­ã€‚",
    prompt: "è®¾è®¡éœ€æ±‚",
    placeholder: "ä¾‹å¦‚ï¼šé’ç»¿è‰²ç§‘æŠ€æ„Ÿçº¸é£žæœºå›¾æ ‡ï¼Œçº¿æ¡ç®€æ´ï¼Œé€æ˜ŽèƒŒæ™¯",
    checking: "æ­£åœ¨æ£€æµ‹æµè§ˆå™¨ä¸Žæ¨¡åž‹â€¦",
    detecting: "æ­£åœ¨è¯†åˆ«è®¾è®¡éœ€æ±‚çš„è¾“å…¥è¯­è¨€",
    translating: "æ­£åœ¨å°†è®¾è®¡éœ€æ±‚ç¿»è¯‘æˆè‹±æ–‡",
    translationDownloading: "æ­£åœ¨ä¸‹è½½æœ¬åœ°ç¿»è¯‘è¯­è¨€åŒ…",
    translationUnsupported: "å½“å‰æµè§ˆå™¨æ— æ³•å°†æ­¤ç•Œé¢è¯­è¨€ç¿»è¯‘æˆè‹±æ–‡",
    ready: "æ¨¡åž‹å·²å°±ç»ªï¼Œå¯ä»¥æœ¬åœ°ç”Ÿæˆ",
    downloadable: "æ”¯æŒæœ¬åœ°ç”Ÿæˆï¼Œé¦–æ¬¡ä½¿ç”¨ä¼šå‡†å¤‡è‹±æ–‡ç¿»è¯‘åŒ…å’Œ Gemini Nano æ¨¡åž‹",
    downloading: "æ­£åœ¨ä¸‹è½½å¹¶å‡†å¤‡æ¨¡åž‹",
    generating: "Gemini Nano æ­£åœ¨è®¾è®¡ SVG",
    validating: "æ­£åœ¨è§£æžå¹¶å®‰å…¨æ ¡éªŒçŸ¢é‡å›¾",
    unsupported: "å½“å‰æµè§ˆå™¨ä¸æ”¯æŒå†…ç½® Gemini Nano",
    unsupportedHint: "è¯·ä½¿ç”¨æ”¯æŒ Prompt API çš„æ¡Œé¢ç‰ˆ Chrome æˆ– Edgeï¼Œå¹¶ç¡®è®¤è®¾å¤‡æ»¡è¶³æœ¬åœ°æ¨¡åž‹è¦æ±‚ã€‚",
    localNote: "é¦–æ¬¡æ¨¡åž‹ä¸‹è½½éœ€è¦ç½‘ç»œï¼Œä¹‹åŽå¯ä»Žæµè§ˆå™¨æœ¬åœ°ä½¿ç”¨ã€‚",
    generate: "ç”ŸæˆçŸ¢é‡å›¾",
    downloadGenerate: "ä¸‹è½½æ¨¡åž‹å¹¶ç”Ÿæˆ",
    cancel: "å–æ¶ˆ",
    close: "å…³é—­",
    failed: "è¿™æ¬¡æ²¡æœ‰ç”Ÿæˆå¯ç”¨çš„ SVGï¼Œè¯·ä¿®æ”¹æè¿°åŽé‡è¯•ã€‚",
  },
  en: {
    cardTitle: "AI design", cardHint: "Gemini Nano Â· On-device", cardMeta: "Describe it, get editable SVG",
    kicker: "Local AI vector design", title: "Design a vector with Gemini Nano", intro: "Describe the graphic you need. Your prompt and generation stay in the browser.",
    prompt: "Design request", placeholder: "e.g. A clean teal paper-plane icon with a transparent background",
    checking: "Checking browser and modelâ€¦", detecting: "Detecting the design request language", ready: "Model ready for local generation", downloadable: "Local generation is supported; English translation and Gemini Nano resources are prepared on first use",
    translating: "Translating the design request into English", translationDownloading: "Downloading the local translation language pack", translationUnsupported: "This browser cannot translate the selected interface language into English",
    downloading: "Downloading and preparing the model", generating: "Gemini Nano is designing the SVG", validating: "Parsing and safely validating the vector",
    unsupported: "Built-in Gemini Nano is not supported in this browser", unsupportedHint: "Use a Prompt API-capable desktop Chrome or Edge browser on a supported device.",
    localNote: "The first model download needs a network connection. Later runs use the browser-local model.", generate: "Generate vector",
    downloadGenerate: "Download model & generate", cancel: "Cancel", close: "Close", failed: "No usable SVG was generated. Adjust the description and try again.",
  },
  ja: {
    cardTitle: "AIãƒ‡ã‚¶ã‚¤ãƒ³", cardHint: "Gemini Nanoãƒ»ç«¯æœ«å†…", cardMeta: "èª¬æ˜Žã‹ã‚‰ç·¨é›†å¯èƒ½ãªSVGã‚’ç”Ÿæˆ", kicker: "ãƒ­ãƒ¼ã‚«ãƒ«AIãƒ™ã‚¯ã‚¿ãƒ¼ãƒ‡ã‚¶ã‚¤ãƒ³",
    title: "Gemini Nanoã§ãƒ™ã‚¯ã‚¿ãƒ¼ã‚’ãƒ‡ã‚¶ã‚¤ãƒ³", intro: "å¿…è¦ãªã‚°ãƒ©ãƒ•ã‚£ãƒƒã‚¯ã‚’èª¬æ˜Žã—ã¦ãã ã•ã„ã€‚å‡¦ç†ã¯ãƒ–ãƒ©ã‚¦ã‚¶å†…ã§å®Œçµã—ã¾ã™ã€‚", prompt: "ãƒ‡ã‚¶ã‚¤ãƒ³è¦ä»¶",
    placeholder: "ä¾‹ï¼šé€æ˜ŽèƒŒæ™¯ã®ã‚·ãƒ³ãƒ—ãƒ«ãªé’ç·‘è‰²ã®ç´™é£›è¡Œæ©Ÿã‚¢ã‚¤ã‚³ãƒ³", checking: "ãƒ–ãƒ©ã‚¦ã‚¶ã¨ãƒ¢ãƒ‡ãƒ«ã‚’ç¢ºèªä¸­â€¦", detecting: "å…¥åŠ›è¨€èªžã‚’è­˜åˆ¥ä¸­", ready: "ãƒ­ãƒ¼ã‚«ãƒ«ç”Ÿæˆã®æº–å‚™ãŒã§ãã¾ã—ãŸ",
    translating: "ãƒ‡ã‚¶ã‚¤ãƒ³è¦ä»¶ã‚’è‹±èªžã«ç¿»è¨³ä¸­", translationDownloading: "ç¿»è¨³è¨€èªžãƒ‘ãƒƒã‚¯ã‚’ãƒ€ã‚¦ãƒ³ãƒ­ãƒ¼ãƒ‰ä¸­", translationUnsupported: "ã“ã®è¨€èªžã‹ã‚‰è‹±èªžã¸ã®ç¿»è¨³ã¯åˆ©ç”¨ã§ãã¾ã›ã‚“",
    downloadable: "ãƒ­ãƒ¼ã‚«ãƒ«ç”Ÿæˆã«å¯¾å¿œã€‚åˆå›žã«è‹±èªžç¿»è¨³ãƒ‘ãƒƒã‚¯ã¨ãƒ¢ãƒ‡ãƒ«ã‚’æº–å‚™ã—ã¾ã™", downloading: "ãƒ¢ãƒ‡ãƒ«ã‚’ãƒ€ã‚¦ãƒ³ãƒ­ãƒ¼ãƒ‰ã—ã¦æº–å‚™ä¸­", generating: "SVGã‚’ãƒ‡ã‚¶ã‚¤ãƒ³ä¸­",
    validating: "ãƒ™ã‚¯ã‚¿ãƒ¼ã‚’è§£æžãƒ»å®‰å…¨ç¢ºèªä¸­", unsupported: "ã“ã®ãƒ–ãƒ©ã‚¦ã‚¶ã¯å†…è”µGemini Nanoã«å¯¾å¿œã—ã¦ã„ã¾ã›ã‚“", unsupportedHint: "Prompt APIå¯¾å¿œã®ãƒ‡ã‚¹ã‚¯ãƒˆãƒƒãƒ—ç‰ˆChromeã¾ãŸã¯Edgeã‚’ä½¿ç”¨ã—ã¦ãã ã•ã„ã€‚",
    localNote: "åˆå›žãƒ€ã‚¦ãƒ³ãƒ­ãƒ¼ãƒ‰ã«ã¯ãƒãƒƒãƒˆæŽ¥ç¶šãŒå¿…è¦ã§ã™ã€‚", generate: "ãƒ™ã‚¯ã‚¿ãƒ¼ã‚’ç”Ÿæˆ", downloadGenerate: "ãƒ¢ãƒ‡ãƒ«ã‚’å–å¾—ã—ã¦ç”Ÿæˆ", cancel: "ã‚­ãƒ£ãƒ³ã‚»ãƒ«", close: "é–‰ã˜ã‚‹", failed: "æœ‰åŠ¹ãªSVGã‚’ç”Ÿæˆã§ãã¾ã›ã‚“ã§ã—ãŸã€‚è¦ä»¶ã‚’èª¿æ•´ã—ã¦ãã ã•ã„ã€‚",
  },
  ko: {
    cardTitle: "AI ë””ìžì¸", cardHint: "Gemini Nano Â· ê¸°ê¸° ë‚´", cardMeta: "ì„¤ëª…ìœ¼ë¡œ íŽ¸ì§‘ ê°€ëŠ¥í•œ SVG ìƒì„±", kicker: "ë¡œì»¬ AI ë²¡í„° ë””ìžì¸",
    title: "Gemini Nanoë¡œ ë²¡í„° ë””ìžì¸", intro: "í•„ìš”í•œ ê·¸ëž˜í”½ì„ ì„¤ëª…í•˜ì„¸ìš”. ìƒì„±ì€ ë¸Œë¼ìš°ì € ì•ˆì—ì„œ ì²˜ë¦¬ë©ë‹ˆë‹¤.", prompt: "ë””ìžì¸ ìš”ì²­",
    placeholder: "ì˜ˆ: íˆ¬ëª… ë°°ê²½ì˜ ê¹”ë”í•œ ì²­ë¡ìƒ‰ ì¢…ì´ë¹„í–‰ê¸° ì•„ì´ì½˜", checking: "ë¸Œë¼ìš°ì €ì™€ ëª¨ë¸ í™•ì¸ ì¤‘â€¦", detecting: "ìž…ë ¥ ì–¸ì–´ ê°ì§€ ì¤‘", ready: "ë¡œì»¬ ìƒì„± ì¤€ë¹„ ì™„ë£Œ",
    translating: "ë””ìžì¸ ìš”ì²­ì„ ì˜ì–´ë¡œ ë²ˆì—­ ì¤‘", translationDownloading: "ë²ˆì—­ ì–¸ì–´ íŒ© ë‹¤ìš´ë¡œë“œ ì¤‘", translationUnsupported: "ì´ ì–¸ì–´ë¥¼ ì˜ì–´ë¡œ ë²ˆì—­í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤",
    downloadable: "ë¡œì»¬ ìƒì„±ì„ ì§€ì›í•©ë‹ˆë‹¤. ì²˜ìŒ ì‚¬ìš© ì‹œ ì˜ì–´ ë²ˆì—­ íŒ©ê³¼ ëª¨ë¸ì„ ì¤€ë¹„í•©ë‹ˆë‹¤", downloading: "ëª¨ë¸ ë‹¤ìš´ë¡œë“œ ë° ì¤€ë¹„ ì¤‘", generating: "SVG ë””ìžì¸ ì¤‘", validating: "ë²¡í„° êµ¬ë¬¸ ë¶„ì„ ë° ì•ˆì „ ê²€ì‚¬ ì¤‘",
    unsupported: "ì´ ë¸Œë¼ìš°ì €ëŠ” ë‚´ìž¥ Gemini Nanoë¥¼ ì§€ì›í•˜ì§€ ì•ŠìŠµë‹ˆë‹¤", unsupportedHint: "Prompt APIë¥¼ ì§€ì›í•˜ëŠ” ë°ìŠ¤í¬í†± Chrome ë˜ëŠ” Edgeë¥¼ ì‚¬ìš©í•˜ì„¸ìš”.",
    localNote: "ì²« ëª¨ë¸ ë‹¤ìš´ë¡œë“œì—ëŠ” ë„¤íŠ¸ì›Œí¬ê°€ í•„ìš”í•©ë‹ˆë‹¤.", generate: "ë²¡í„° ìƒì„±", downloadGenerate: "ëª¨ë¸ ë‹¤ìš´ë¡œë“œ í›„ ìƒì„±", cancel: "ì·¨ì†Œ", close: "ë‹«ê¸°", failed: "ì‚¬ìš© ê°€ëŠ¥í•œ SVGë¥¼ ìƒì„±í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. ì„¤ëª…ì„ ìˆ˜ì •í•´ ë³´ì„¸ìš”.",
  },
  es: {
    cardTitle: "DiseÃ±o IA", cardHint: "Gemini Nano Â· En el dispositivo", cardMeta: "Describe y crea un SVG editable", kicker: "DiseÃ±o vectorial con IA local",
    title: "DiseÃ±a un vector con Gemini Nano", intro: "Describe el grÃ¡fico. La solicitud y la generaciÃ³n permanecen en el navegador.", prompt: "Solicitud de diseÃ±o",
    placeholder: "Ej.: icono limpio de aviÃ³n de papel turquesa con fondo transparente", checking: "Comprobando navegador y modeloâ€¦", detecting: "Detectando el idioma de la solicitud", ready: "Modelo listo para generar localmente",
    translating: "Traduciendo la solicitud al inglÃ©s", translationDownloading: "Descargando el paquete de traducciÃ³n local", translationUnsupported: "No se puede traducir este idioma al inglÃ©s en el navegador",
    downloadable: "Compatible; la traducciÃ³n al inglÃ©s y el modelo se preparan en el primer uso", downloading: "Descargando y preparando el modelo", generating: "DiseÃ±ando el SVG", validating: "Analizando y validando el vector",
    unsupported: "Este navegador no admite Gemini Nano integrado", unsupportedHint: "Usa Chrome o Edge de escritorio compatible con Prompt API.", localNote: "La primera descarga requiere conexiÃ³n.",
    generate: "Generar vector", downloadGenerate: "Descargar modelo y generar", cancel: "Cancelar", close: "Cerrar", failed: "No se generÃ³ un SVG vÃ¡lido. Ajusta la descripciÃ³n.",
  },
  fr: {
    cardTitle: "Design IA", cardHint: "Gemini Nano Â· Sur lâ€™appareil", cardMeta: "DÃ©crivez, obtenez un SVG modifiable", kicker: "Design vectoriel IA local",
    title: "CrÃ©er un vecteur avec Gemini Nano", intro: "DÃ©crivez le visuel. La requÃªte et la gÃ©nÃ©ration restent dans le navigateur.", prompt: "Demande de design",
    placeholder: "Ex. : icÃ´ne dâ€™avion en papier turquoise, fond transparent", checking: "VÃ©rification du navigateur et du modÃ¨leâ€¦", detecting: "DÃ©tection de la langue de la demande", ready: "ModÃ¨le prÃªt pour la gÃ©nÃ©ration locale",
    translating: "Traduction de la demande en anglais", translationDownloading: "TÃ©lÃ©chargement du pack de traduction local", translationUnsupported: "La traduction de cette langue vers lâ€™anglais nâ€™est pas disponible",
    downloadable: "Compatible ; la traduction anglaise et le modÃ¨le seront prÃ©parÃ©s au premier usage", downloading: "TÃ©lÃ©chargement et prÃ©paration du modÃ¨le", generating: "CrÃ©ation du SVG", validating: "Analyse et validation du vecteur",
    unsupported: "Gemini Nano intÃ©grÃ© nâ€™est pas pris en charge", unsupportedHint: "Utilisez Chrome ou Edge sur ordinateur avec la Prompt API.", localNote: "Le premier tÃ©lÃ©chargement nÃ©cessite une connexion.",
    generate: "GÃ©nÃ©rer le vecteur", downloadGenerate: "TÃ©lÃ©charger et gÃ©nÃ©rer", cancel: "Annuler", close: "Fermer", failed: "Aucun SVG valide nâ€™a Ã©tÃ© gÃ©nÃ©rÃ©. Modifiez la description.",
  },
  de: {
    cardTitle: "KI-Design", cardHint: "Gemini Nano Â· Lokal", cardMeta: "Beschreiben und editierbares SVG erhalten", kicker: "Lokales KI-Vektordesign",
    title: "Vektor mit Gemini Nano gestalten", intro: "Beschreibe die gewÃ¼nschte Grafik. Eingabe und Generierung bleiben im Browser.", prompt: "Designwunsch",
    placeholder: "z. B. klares tÃ¼rkisfarbenes Papierflieger-Icon, transparenter Hintergrund", checking: "Browser und Modell werden geprÃ¼ftâ€¦", detecting: "Eingabesprache wird erkannt", ready: "Modell ist lokal einsatzbereit",
    translating: "Designwunsch wird ins Englische Ã¼bersetzt", translationDownloading: "Lokales Ãœbersetzungspaket wird geladen", translationUnsupported: "Diese Sprache kann im Browser nicht ins Englische Ã¼bersetzt werden",
    downloadable: "UnterstÃ¼tzt; Englisch-Ãœbersetzung und Modell werden bei der ersten Nutzung vorbereitet", downloading: "Modell wird geladen und vorbereitet", generating: "SVG wird gestaltet", validating: "Vektor wird geprÃ¼ft",
    unsupported: "Integriertes Gemini Nano wird nicht unterstÃ¼tzt", unsupportedHint: "Nutze einen Prompt-API-fÃ¤higen Desktop-Browser Chrome oder Edge.", localNote: "Der erste Download benÃ¶tigt eine Verbindung.",
    generate: "Vektor generieren", downloadGenerate: "Modell laden & generieren", cancel: "Abbrechen", close: "SchlieÃŸen", failed: "Kein gÃ¼ltiges SVG erzeugt. Bitte Beschreibung anpassen.",
  },
  pt: {
    cardTitle: "Design com IA", cardHint: "Gemini Nano Â· No dispositivo", cardMeta: "Descreva e obtenha SVG editÃ¡vel", kicker: "Design vetorial com IA local",
    title: "Crie um vetor com Gemini Nano", intro: "Descreva o grÃ¡fico. O pedido e a geraÃ§Ã£o ficam no navegador.", prompt: "Pedido de design",
    placeholder: "Ex.: Ã­cone limpo de aviÃ£o de papel verde-Ã¡gua, fundo transparente", checking: "Verificando navegador e modeloâ€¦", detecting: "Detectando o idioma do pedido", ready: "Modelo pronto para geraÃ§Ã£o local",
    translating: "Traduzindo o pedido para inglÃªs", translationDownloading: "Baixando o pacote de traduÃ§Ã£o local", translationUnsupported: "O navegador nÃ£o pode traduzir este idioma para inglÃªs",
    downloadable: "CompatÃ­vel; a traduÃ§Ã£o para inglÃªs e o modelo serÃ£o preparados no primeiro uso", downloading: "Baixando e preparando o modelo", generating: "Criando o SVG", validating: "Analisando e validando o vetor",
    unsupported: "Gemini Nano integrado nÃ£o Ã© compatÃ­vel", unsupportedHint: "Use Chrome ou Edge para desktop com Prompt API.", localNote: "O primeiro download precisa de conexÃ£o.",
    generate: "Gerar vetor", downloadGenerate: "Baixar modelo e gerar", cancel: "Cancelar", close: "Fechar", failed: "Nenhum SVG vÃ¡lido foi gerado. Ajuste a descriÃ§Ã£o.",
  },
  th: {
    cardTitle: "à¸­à¸­à¸à¹à¸šà¸šà¸”à¹‰à¸§à¸¢ AI", cardHint: "Gemini Nano Â· à¸šà¸™à¸­à¸¸à¸›à¸à¸£à¸“à¹Œ", cardMeta: "à¸­à¸˜à¸´à¸šà¸²à¸¢à¹€à¸žà¸·à¹ˆà¸­à¸ªà¸£à¹‰à¸²à¸‡ SVG à¸—à¸µà¹ˆà¹à¸à¹‰à¹„à¸‚à¹„à¸”à¹‰", kicker: "à¸­à¸­à¸à¹à¸šà¸šà¹€à¸§à¸à¹€à¸•à¸­à¸£à¹Œà¸”à¹‰à¸§à¸¢ AI à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡",
    title: "à¸­à¸­à¸à¹à¸šà¸šà¹€à¸§à¸à¹€à¸•à¸­à¸£à¹Œà¸”à¹‰à¸§à¸¢ Gemini Nano", intro: "à¸­à¸˜à¸´à¸šà¸²à¸¢à¸à¸£à¸²à¸Ÿà¸´à¸à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸¥à¸°à¸à¸²à¸£à¸ªà¸£à¹‰à¸²à¸‡à¸ˆà¸°à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¹€à¸šà¸£à¸²à¸§à¹Œà¹€à¸‹à¸­à¸£à¹Œ", prompt: "à¸„à¸§à¸²à¸¡à¸•à¹‰à¸­à¸‡à¸à¸²à¸£",
    placeholder: "à¹€à¸Šà¹ˆà¸™ à¹„à¸­à¸„à¸­à¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸šà¸´à¸™à¸à¸£à¸°à¸”à¸²à¸©à¸ªà¸µà¹€à¸‚à¸µà¸¢à¸§à¸­à¸¡à¸Ÿà¹‰à¸² à¸žà¸·à¹‰à¸™à¸«à¸¥à¸±à¸‡à¹‚à¸›à¸£à¹ˆà¸‡à¹ƒà¸ª", checking: "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹€à¸šà¸£à¸²à¸§à¹Œà¹€à¸‹à¸­à¸£à¹Œà¹à¸¥à¸°à¹‚à¸¡à¹€à¸”à¸¥â€¦", detecting: "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¸ à¸²à¸©à¸²à¸—à¸µà¹ˆà¸›à¹‰à¸­à¸™", ready: "à¹‚à¸¡à¹€à¸”à¸¥à¸žà¸£à¹‰à¸­à¸¡à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡",
    translating: "à¸à¸³à¸¥à¸±à¸‡à¹à¸›à¸¥à¸„à¸§à¸²à¸¡à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¹€à¸›à¹‡à¸™à¸ à¸²à¸©à¸²à¸­à¸±à¸‡à¸à¸¤à¸©", translationDownloading: "à¸à¸³à¸¥à¸±à¸‡à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸Šà¸¸à¸”à¸ à¸²à¸©à¸²à¹à¸›à¸¥à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡", translationUnsupported: "à¹€à¸šà¸£à¸²à¸§à¹Œà¹€à¸‹à¸­à¸£à¹Œà¹à¸›à¸¥à¸ à¸²à¸©à¸²à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸­à¸±à¸‡à¸à¸¤à¸©à¹„à¸¡à¹ˆà¹„à¸”à¹‰",
    downloadable: "à¸£à¸­à¸‡à¸£à¸±à¸š à¹‚à¸”à¸¢à¸ˆà¸°à¹€à¸•à¸£à¸µà¸¢à¸¡à¸Šà¸¸à¸”à¹à¸›à¸¥à¸­à¸±à¸‡à¸à¸¤à¸©à¹à¸¥à¸°à¹‚à¸¡à¹€à¸”à¸¥à¹€à¸¡à¸·à¹ˆà¸­à¹ƒà¸Šà¹‰à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸", downloading: "à¸à¸³à¸¥à¸±à¸‡à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹à¸¥à¸°à¹€à¸•à¸£à¸µà¸¢à¸¡à¹‚à¸¡à¹€à¸”à¸¥", generating: "à¸à¸³à¸¥à¸±à¸‡à¸­à¸­à¸à¹à¸šà¸š SVG", validating: "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹€à¸§à¸à¹€à¸•à¸­à¸£à¹Œ",
    unsupported: "à¹€à¸šà¸£à¸²à¸§à¹Œà¹€à¸‹à¸­à¸£à¹Œà¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š Gemini Nano à¹ƒà¸™à¸•à¸±à¸§", unsupportedHint: "à¹ƒà¸Šà¹‰ Chrome à¸«à¸£à¸·à¸­ Edge à¸šà¸™à¹€à¸”à¸ªà¸à¹Œà¸—à¹‡à¸­à¸›à¸—à¸µà¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š Prompt API", localNote: "à¸à¸²à¸£à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸à¸•à¹‰à¸­à¸‡à¹ƒà¸Šà¹‰à¸­à¸´à¸™à¹€à¸—à¸­à¸£à¹Œà¹€à¸™à¹‡à¸•",
    generate: "à¸ªà¸£à¹‰à¸²à¸‡à¹€à¸§à¸à¹€à¸•à¸­à¸£à¹Œ", downloadGenerate: "à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹à¸¥à¸°à¸ªà¸£à¹‰à¸²à¸‡", cancel: "à¸¢à¸à¹€à¸¥à¸´à¸", close: "à¸›à¸´à¸”", failed: "à¸ªà¸£à¹‰à¸²à¸‡ SVG à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¹„à¸”à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¹‚à¸›à¸£à¸”à¹à¸à¹‰à¸„à¸³à¸­à¸˜à¸´à¸šà¸²à¸¢",
  },
  vi: {
    cardTitle: "Thiáº¿t káº¿ AI", cardHint: "Gemini Nano Â· TrÃªn thiáº¿t bá»‹", cardMeta: "MÃ´ táº£ Ä‘á»ƒ táº¡o SVG cÃ³ thá»ƒ chá»‰nh sá»­a", kicker: "Thiáº¿t káº¿ vector AI cá»¥c bá»™",
    title: "Thiáº¿t káº¿ vector báº±ng Gemini Nano", intro: "MÃ´ táº£ hÃ¬nh báº¡n cáº§n. YÃªu cáº§u vÃ  quÃ¡ trÃ¬nh táº¡o náº±m trong trÃ¬nh duyá»‡t.", prompt: "YÃªu cáº§u thiáº¿t káº¿",
    placeholder: "VD: biá»ƒu tÆ°á»£ng mÃ¡y bay giáº¥y xanh ngá»c, ná»n trong suá»‘t", checking: "Äang kiá»ƒm tra trÃ¬nh duyá»‡t vÃ  mÃ´ hÃ¬nhâ€¦", detecting: "Äang nháº­n diá»‡n ngÃ´n ngá»¯ nháº­p", ready: "MÃ´ hÃ¬nh sáºµn sÃ ng táº¡o cá»¥c bá»™",
    translating: "Äang dá»‹ch yÃªu cáº§u sang tiáº¿ng Anh", translationDownloading: "Äang táº£i gÃ³i dá»‹ch cá»¥c bá»™", translationUnsupported: "TrÃ¬nh duyá»‡t khÃ´ng thá»ƒ dá»‹ch ngÃ´n ngá»¯ nÃ y sang tiáº¿ng Anh",
    downloadable: "ÄÆ°á»£c há»— trá»£; gÃ³i dá»‹ch tiáº¿ng Anh vÃ  mÃ´ hÃ¬nh sáº½ Ä‘Æ°á»£c chuáº©n bá»‹ á»Ÿ láº§n dÃ¹ng Ä‘áº§u", downloading: "Äang táº£i vÃ  chuáº©n bá»‹ mÃ´ hÃ¬nh", generating: "Äang thiáº¿t káº¿ SVG", validating: "Äang phÃ¢n tÃ­ch vÃ  xÃ¡c thá»±c vector",
    unsupported: "TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ Gemini Nano tÃ­ch há»£p", unsupportedHint: "DÃ¹ng Chrome hoáº·c Edge mÃ¡y tÃ­nh cÃ³ Prompt API.", localNote: "Láº§n táº£i Ä‘áº§u cáº§n káº¿t ná»‘i máº¡ng.",
    generate: "Táº¡o vector", downloadGenerate: "Táº£i mÃ´ hÃ¬nh vÃ  táº¡o", cancel: "Há»§y", close: "ÄÃ³ng", failed: "KhÃ´ng táº¡o Ä‘Æ°á»£c SVG há»£p lá»‡. HÃ£y Ä‘iá»u chá»‰nh mÃ´ táº£.",
  },
  ru: {
    cardTitle: "Ð˜Ð˜-Ð´Ð¸Ð·Ð°Ð¹Ð½", cardHint: "Gemini Nano Â· ÐÐ° ÑƒÑÑ‚Ñ€Ð¾Ð¹ÑÑ‚Ð²Ðµ", cardMeta: "ÐžÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ â†’ Ñ€ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€ÑƒÐµÐ¼Ñ‹Ð¹ SVG", kicker: "Ð›Ð¾ÐºÐ°Ð»ÑŒÐ½Ñ‹Ð¹ Ð˜Ð˜-Ð´Ð¸Ð·Ð°Ð¹Ð½ Ð²ÐµÐºÑ‚Ð¾Ñ€Ð°",
    title: "Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ð²ÐµÐºÑ‚Ð¾Ñ€ Ñ Gemini Nano", intro: "ÐžÐ¿Ð¸ÑˆÐ¸Ñ‚Ðµ Ð½ÑƒÐ¶Ð½ÑƒÑŽ Ð³Ñ€Ð°Ñ„Ð¸ÐºÑƒ. Ð—Ð°Ð¿Ñ€Ð¾Ñ Ð¸ Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ñ Ð¾ÑÑ‚Ð°ÑŽÑ‚ÑÑ Ð² Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€Ðµ.", prompt: "Ð—Ð°Ð´Ð°Ñ‡Ð°",
    placeholder: "ÐÐ°Ð¿Ñ€Ð¸Ð¼ÐµÑ€: Ð»Ð°ÐºÐ¾Ð½Ð¸Ñ‡Ð½Ð°Ñ Ð±Ð¸Ñ€ÑŽÐ·Ð¾Ð²Ð°Ñ Ð¸ÐºÐ¾Ð½ÐºÐ° Ð±ÑƒÐ¼Ð°Ð¶Ð½Ð¾Ð³Ð¾ ÑÐ°Ð¼Ð¾Ð»Ñ‘Ñ‚Ð°, Ð¿Ñ€Ð¾Ð·Ñ€Ð°Ñ‡Ð½Ñ‹Ð¹ Ñ„Ð¾Ð½", checking: "ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€ Ð¸ Ð¼Ð¾Ð´ÐµÐ»ÑŒâ€¦", detecting: "ÐžÐ¿Ñ€ÐµÐ´ÐµÐ»ÑÐµÐ¼ ÑÐ·Ñ‹Ðº Ð·Ð°Ð¿Ñ€Ð¾ÑÐ°", ready: "ÐœÐ¾Ð´ÐµÐ»ÑŒ Ð³Ð¾Ñ‚Ð¾Ð²Ð° Ðº Ð»Ð¾ÐºÐ°Ð»ÑŒÐ½Ð¾Ð¹ Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ð¸",
    translating: "ÐŸÐµÑ€ÐµÐ²Ð¾Ð´Ð¸Ð¼ Ð·Ð°Ð´Ð°Ñ‡Ñƒ Ð½Ð° Ð°Ð½Ð³Ð»Ð¸Ð¹ÑÐºÐ¸Ð¹", translationDownloading: "Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð»Ð¾ÐºÐ°Ð»ÑŒÐ½Ñ‹Ð¹ ÑÐ·Ñ‹ÐºÐ¾Ð²Ð¾Ð¹ Ð¿Ð°ÐºÐµÑ‚", translationUnsupported: "Ð‘Ñ€Ð°ÑƒÐ·ÐµÑ€ Ð½Ðµ Ð¼Ð¾Ð¶ÐµÑ‚ Ð¿ÐµÑ€ÐµÐ²ÐµÑÑ‚Ð¸ ÑÑ‚Ð¾Ñ‚ ÑÐ·Ñ‹Ðº Ð½Ð° Ð°Ð½Ð³Ð»Ð¸Ð¹ÑÐºÐ¸Ð¹",
    downloadable: "ÐŸÐ¾Ð´Ð´ÐµÑ€Ð¶Ð¸Ð²Ð°ÐµÑ‚ÑÑ; Ð¿Ñ€Ð¸ Ð¿ÐµÑ€Ð²Ð¾Ð¼ Ð·Ð°Ð¿ÑƒÑÐºÐµ Ð±ÑƒÐ´ÑƒÑ‚ Ð¿Ð¾Ð´Ð³Ð¾Ñ‚Ð¾Ð²Ð»ÐµÐ½Ñ‹ Ð¿ÐµÑ€ÐµÐ²Ð¾Ð´ Ð½Ð° Ð°Ð½Ð³Ð»Ð¸Ð¹ÑÐºÐ¸Ð¹ Ð¸ Ð¼Ð¾Ð´ÐµÐ»ÑŒ", downloading: "Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¸ Ð¿Ð¾Ð´Ð³Ð¾Ñ‚Ð¾Ð²ÐºÐ° Ð¼Ð¾Ð´ÐµÐ»Ð¸", generating: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ SVG", validating: "Ð Ð°Ð·Ð±Ð¾Ñ€ Ð¸ Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð°Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð²ÐµÐºÑ‚Ð¾Ñ€Ð°",
    unsupported: "Ð’ÑÑ‚Ñ€Ð¾ÐµÐ½Ð½Ñ‹Ð¹ Gemini Nano Ð½Ðµ Ð¿Ð¾Ð´Ð´ÐµÑ€Ð¶Ð¸Ð²Ð°ÐµÑ‚ÑÑ", unsupportedHint: "Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ Ð½Ð°ÑÑ‚Ð¾Ð»ÑŒÐ½Ñ‹Ð¹ Chrome Ð¸Ð»Ð¸ Edge Ñ Prompt API.", localNote: "Ð”Ð»Ñ Ð¿ÐµÑ€Ð²Ð¾Ð¹ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸ Ð½ÑƒÐ¶Ð½Ð° ÑÐµÑ‚ÑŒ.",
    generate: "Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ð²ÐµÐºÑ‚Ð¾Ñ€", downloadGenerate: "Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ð¸ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ", cancel: "ÐžÑ‚Ð¼ÐµÐ½Ð°", close: "Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ", failed: "ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒ ÐºÐ¾Ñ€Ñ€ÐµÐºÑ‚Ð½Ñ‹Ð¹ SVG. Ð˜Ð·Ð¼ÐµÐ½Ð¸Ñ‚Ðµ Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸Ðµ.",
  },
};

function AiVectorDesignCard({ language, onClick }) {
  const copy = AI_VECTOR_COPY.en;
  return (
    <button className="ai-vector-card" type="button" onClick={onClick}>
      <span className="ai-vector-card-art" aria-hidden="true">
        <MagicWand size={34} weight="duotone" />
        <i>AI</i>
      </span>
      <span><strong>{copy.cardTitle}</strong><small>{copy.cardHint}</small></span>
    </button>
  );
}

function AiVectorDesignDialog({ language, onClose, onGenerated }) {
  const copy = AI_VECTOR_COPY.en;
  const [request, setRequest] = useState("");
  const [availability, setAvailability] = useState("checking");
  const [phase, setPhase] = useState("checking");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [translationUnavailable, setTranslationUnavailable] = useState(false);
  const [translationAvailability, setTranslationAvailability] = useState("available");
  const abortRef = useRef(null);
  const running = ["detectingLanguage", "translationDownloading", "translating", "downloading", "model", "generating", "validating"].includes(phase);

  useEffect(() => {
    let active = true;
    void detectGeminiNanoVectorSupport(globalThis, language).then((result) => {
      if (!active) return;
      setAvailability(result.availability);
      setTranslationAvailability(result.translationAvailability || "available");
      setTranslationUnavailable(result.detectorAvailability === "unavailable" || result.translationAvailability === "unavailable");
      setPhase(result.supported ? "idle" : "unsupported");
    });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [language]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !running) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, running]);

  const startGeneration = async () => {
    if (!request.trim() || running || availability === "unavailable") return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setProgress(0);
    setPhase(availability === "available" ? "model" : "downloading");
    try {
      const asset = await generateVectorWithGeminiNano({
        request,
        sourceLanguage: language,
        signal: controller.signal,
        onLanguageDetectionDownloadProgress: (value) => {
          setPhase("detectingLanguage");
          setProgress(Math.round(value * 100));
        },
        onTranslationDownloadProgress: (value) => {
          setPhase("translationDownloading");
          setProgress(Math.round(value * 100));
        },
        onDownloadProgress: (value) => {
          setPhase("downloading");
          setProgress(Math.round(value * 100));
        },
        onPhaseChange: setPhase,
      });
      onGenerated(asset);
    } catch (generationError) {
      if (generationError?.name === "AbortError") {
        setPhase("idle");
        return;
      }
      const errorCode = String(generationError?.message || "");
      setError(/TRANSLAT|LANGUAGE_DETECTOR/.test(errorCode) ? copy.translationUnsupported : copy.failed);
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  const requiresDownload = availability !== "available" || translationAvailability !== "available";
  const statusText = phase === "checking" ? copy.checking
    : phase === "unsupported" ? (translationUnavailable ? copy.translationUnsupported : copy.unsupported)
      : phase === "detectingLanguage" ? copy.detecting
      : phase === "translationDownloading" ? copy.translationDownloading
        : phase === "translating" ? copy.translating
      : phase === "downloading" || phase === "model" ? copy.downloading
        : phase === "generating" ? copy.generating
          : phase === "validating" ? copy.validating
            : !requiresDownload ? copy.ready
              : copy.downloadable;

  return (
    <div className="ai-vector-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget && !running) onClose();
    }}>
      <section className="ai-vector-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-vector-title">
        <header>
          <span className="ai-vector-dialog-icon"><MagicWand size={23} weight="duotone" /></span>
          <div><small>{copy.kicker}</small><h2 id="ai-vector-title">{copy.title}</h2></div>
          <button type="button" onClick={onClose} disabled={running} aria-label={copy.close}><X size={18} /></button>
        </header>
        <div className="ai-vector-dialog-body">
          <p>{copy.intro}</p>
          <label>{copy.prompt}<textarea autoFocus rows="5" value={request} disabled={running || phase === "unsupported"} placeholder={copy.placeholder} onChange={(event) => setRequest(event.target.value)} /></label>
          <div className={`ai-vector-runtime is-${phase}`}>
            <span>{phase === "idle" && availability === "available" ? <Check size={16} weight="bold" /> : <MagicWand size={16} />}</span>
            <div><strong>{statusText}</strong><small>{phase === "unsupported" && !translationUnavailable ? copy.unsupportedHint : copy.localNote}</small></div>
          </div>
          {running ? (
            <div className="ai-vector-progress" aria-label={statusText}>
              <span style={{ width: phase === "detectingLanguage" ? `${Math.max(4, progress || 8)}%` : phase === "translationDownloading" ? `${Math.max(4, progress)}%` : phase === "translating" ? "18%" : phase === "downloading" ? `${Math.max(4, progress)}%` : phase === "model" ? "32%" : phase === "generating" ? "72%" : "92%" }} />
            </div>
          ) : null}
          {error ? <p className="ai-vector-error" role="alert">{error}</p> : null}
        </div>
        <footer>
          <button type="button" className="is-secondary" onClick={() => {
            if (running) abortRef.current?.abort();
            else onClose();
          }}>{copy.cancel}</button>
          <button type="button" className="is-primary" disabled={!request.trim() || phase === "checking" || phase === "unsupported" || running} onClick={() => void startGeneration()}>
            <MagicWand size={16} weight="fill" />
            {requiresDownload ? copy.downloadGenerate : copy.generate}
          </button>
        </footer>
      </section>
    </div>
  );
}

function LibraryTypeTabs({ t, activeType, onSelect }) {
  const viewportRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setEdges({
      left: viewport.scrollLeft > 2,
      right: viewport.scrollLeft < maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(viewport);
    viewport.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", updateEdges);
    };
  }, [updateEdges]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const active = viewport?.querySelector('[aria-selected="true"]');
    if (viewport && active) {
      const viewportRect = viewport.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (activeRect.left < viewportRect.left + 4) {
        viewport.scrollTo({ left: Math.max(0, viewport.scrollLeft + activeRect.left - viewportRect.left - 4), behavior: "smooth" });
      } else if (activeRect.right > viewportRect.right - 4) {
        viewport.scrollTo({ left: Math.min(maxScroll, viewport.scrollLeft + activeRect.right - viewportRect.right + 4), behavior: "smooth" });
      }
    }
    const timer = setTimeout(updateEdges, 220);
    return () => clearTimeout(timer);
  }, [activeType, updateEdges]);

  const scroll = (direction) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const target = Math.max(0, Math.min(maxScroll, viewport.scrollLeft + direction * Math.max(120, viewport.clientWidth * 0.72)));
    viewport.scrollTo({ left: target, behavior: "smooth" });
  };

  const showForwardArrow = edges.right;
  const showBackArrow = !showForwardArrow && edges.left;

  return (
    <div className={`library-type-tabs-shell ${edges.left ? "has-left-shadow" : ""} ${edges.right ? "has-right-shadow" : ""}`}>
      {showBackArrow ? (
        <button
          className="library-type-arrow is-left"
          type="button"
          aria-label={t("scrollTabsLeft")}
          onClick={() => scroll(-1)}
        >
          <CaretLeft size={16} weight="bold" />
        </button>
      ) : null}
      <div className="library-type-tabs" role="tablist" aria-label={t("libraryMediaType")} ref={viewportRef}>
        {["image", "video", "audio", "vector"].map((type) => (
          <button type="button" role="tab" aria-selected={activeType === type} className={activeType === type ? "is-active" : ""} key={type} onClick={() => onSelect(type)}>
            {t(`library${type[0].toUpperCase()}${type.slice(1)}`)}
          </button>
        ))}
      </div>
      {showForwardArrow ? (
        <button
          className="library-type-arrow is-right"
          type="button"
          aria-label={t("scrollTabsRight")}
          onClick={() => scroll(1)}
        >
          <CaretRight size={16} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

const AI_MUSIC_COPY = {
  zh: { title: "AI éŸ³ä¹", hint: "æœ¬åœ°éŸ³ä¹ç”Ÿæˆ", description: "éŸ³ä¹æè¿°", descriptionPlaceholder: "ä¾‹å¦‚ï¼šé›¨å¤œå’–å•¡åº—é‡Œå®‰é™å¿§éƒçš„çˆµå£«é’¢ç´", style: "é£Žæ ¼", mood: "æ°›å›´", instrument: "ä¸»ä¹å™¨", duration: "æ—¶é•¿", bpm: "é€Ÿåº¦", generate: "ç”ŸæˆéŸ³ä¹", cancel: "å–æ¶ˆ", first: "é¦–æ¬¡ä¸‹è½½æ¨¡åž‹ï¼Œä¹‹åŽä»Žæœ¬åœ°ç¼“å­˜åŠ è½½ã€‚", modelSetup: "æ¨¡åž‹å‡†å¤‡", modelReady: "æ¨¡åž‹å·²å°±ç»ª", musicGeneration: "éŸ³ä¹ç”Ÿæˆ", waitingToGenerate: "ç­‰å¾…ç”Ÿæˆ", download: "å¹¶è¡Œä¸‹è½½æ¨¡åž‹", cache: "ä»Žæœ¬åœ°ç¼“å­˜åŠ è½½æ¨¡åž‹", initializing: "åˆå§‹åŒ– WebGPU æ¨¡åž‹", translating: "ç¿»è¯‘éŸ³ä¹æè¿°", conditioning: "ç†è§£éŸ³ä¹æè¿°", generating: "æ­£åœ¨ç”Ÿæˆ", decoding: "æ­£åœ¨åˆæˆéŸ³é¢‘", complete: "å·²æ·»åŠ åˆ° My assets", english: "é«˜çº§ï¼šæ¨¡åž‹æç¤ºè¯" },
  en: { title: "AI music", hint: "Local music", description: "Describe your music", descriptionPlaceholder: "e.g. melancholic jazz piano in a rainy cafÃ©", style: "Style", mood: "Mood", instrument: "Lead", duration: "Length", bpm: "Tempo", generate: "Generate music", cancel: "Cancel", first: "The model downloads once, then loads from local cache.", modelSetup: "Model setup", modelReady: "Model ready", musicGeneration: "Music generation", waitingToGenerate: "Waiting to generate", download: "Downloading model files in parallel", cache: "Loading models from local cache", initializing: "Initializing WebGPU models", translating: "Translating description", conditioning: "Understanding prompt", generating: "Generating", decoding: "Decoding audio", complete: "Added to My assets", english: "Advanced: model prompt" },
};

function AiMusicLibraryCard({ language, onClick }) {
  const copy = AI_MUSIC_COPY.en;
  return (
    <button className="ai-vector-card ai-music-library-card" type="button" onClick={onClick}>
      <span className="ai-vector-card-art" aria-hidden="true">
        <MusicNote size={35} weight="duotone" />
        <i>AI</i>
      </span>
      <span><strong>{copy.title}</strong><small>{copy.hint}</small></span>
    </button>
  );
}
const AI_OPTION_LABELS = {
  zh: { cinematic: "ç”µå½±æ„Ÿ", lofi: "Lo-fi", ambient: "æ°›å›´", electronic: "ç”µå­", orchestral: "ç®¡å¼¦", uplifting: "æŒ¯å¥‹", calm: "å¹³é™", dreamy: "æ¢¦å¹»", dramatic: "æˆå‰§æ€§", dark: "æš—é»‘", piano: "é’¢ç´", guitar: "æœ¨å‰ä»–", synth: "åˆæˆå™¨", strings: "å¼¦ä¹", drums: "é¼“ç»„" },
};

export function AiMusicGenerator({ language, music, embedded = false }) {
  const copy = AI_MUSIC_COPY.en;
  const labels = {};
  const [open, setOpen] = useState(embedded);
  const [selection, setSelection] = useState({ description: "", style: "cinematic", mood: "dreamy", instrument: "piano", seconds: 30, bpm: 90 });
  const running = music?.job?.state === "running";
  const phaseLabel = copy[music?.job?.phase] || copy.generating;
  const setupRunning = running && ["download", "cache", "initializing"].includes(music?.job?.phase);
  const setupProgress = setupRunning ? Math.min(100, Math.round((music.job.progress / 0.64) * 100)) : (running || music?.job?.state === "complete" ? 100 : 0);
  const generationStarted = running && !setupRunning;
  const generationProgress = generationStarted ? Math.max(1, Math.min(100, Math.round(((music.job.progress - 0.64) / 0.36) * 100))) : (music?.job?.state === "complete" ? 100 : 0);
  const activeStageProgress = setupRunning ? setupProgress : generationProgress;
  const activeStageLabel = setupRunning ? copy.modelSetup : copy.musicGeneration;
  const activeStageStatus = setupRunning ? phaseLabel : generationStarted ? phaseLabel : copy.waitingToGenerate;
  const select = (group, value) => setSelection((current) => ({ ...current, [group]: value }));
  const HeadTag = embedded ? "div" : "button";
  return (
    <section className={`ai-music-card ${open ? "is-open" : ""} ${embedded ? "is-embedded" : ""}`}>
      {!embedded ? <HeadTag className="ai-music-card-head" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="ai-music-spark">âœ¦</span>
        <span><strong>{copy.title}</strong><small>{copy.hint}</small></span>
        <CaretDown size={17} />
      </HeadTag> : null}
      {open ? (
        <div className="ai-music-card-body">
          <label className="ai-music-description">{copy.description}<textarea rows="3" value={selection.description} disabled={running} placeholder={copy.descriptionPlaceholder} onChange={(event) => select("description", event.target.value)} /></label>
          <div className="ai-music-select-grid">
            {[["style", copy.style], ["mood", copy.mood], ["instrument", copy.instrument]].map(([group, title]) => (
              <label key={group}>{title}<select value={selection[group]} disabled={running} onChange={(event) => select(group, event.target.value)}>
                {AI_MUSIC_PRESETS[group].map(([id]) => <option value={id} key={id}>{labels[id] || id}</option>)}
              </select></label>
            ))}
          </div>
          <div className="ai-music-numbers">
            <label>{copy.duration}<select value={selection.seconds} disabled={running} onChange={(event) => select("seconds", Number(event.target.value))}><option value="30">30s</option><option value="60">60s</option><option value="90">90s</option><option value="120">120s</option></select></label>
            <label>{copy.bpm}<input type="number" min="60" max="180" value={selection.bpm} disabled={running} onChange={(event) => select("bpm", event.target.value)} /></label>
          </div>
          <details className="ai-music-prompt"><summary>{copy.english}</summary><p>{buildEnglishMusicPrompt(selection)}</p></details>
          <small className="ai-music-model-note">{copy.first}</small>
          {running ? (
            <div className="ai-music-stage-progress">
              <div className="ai-music-stage-labels">
                <span className={setupProgress === 100 ? "is-complete" : "is-active"}><i>1</i>{copy.modelSetup}<small>{setupProgress === 100 ? copy.modelReady : setupRunning ? `${setupProgress}%` : ""}</small></span>
                <span className={generationStarted ? "is-active" : ""}><i>2</i>{copy.musicGeneration}<small>{generationStarted ? `${generationProgress}%` : copy.waitingToGenerate}</small></span>
              </div>
              <div className="ai-music-progress">
                <div><strong>{activeStageLabel}</strong><small>{activeStageStatus} Â· {activeStageProgress}%</small></div>
                <span><i style={{ width: `${activeStageProgress}%` }} /></span>
              </div>
            </div>
          ) : null}
          {music?.job?.error ? <p className="ai-music-error">{music.job.error}</p> : null}
          {music?.job?.state === "complete" ? <p className="ai-music-success">{copy.complete}</p> : null}
          <div className="ai-music-actions">
            {running ? <button type="button" className="secondary" onClick={music.cancel}>{copy.cancel}</button> : <button type="button" className="primary" onClick={() => music.generate(selection)}><MusicNote size={17} />{copy.generate}</button>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssetPreviewDialog({ asset, t, onClose }) {
  const mediaSrc = asset.type === "image" ? (asset.originalSrc || asset.src) : (asset.previewSrc || asset.src);
  const assetDisplayName = asset.nameKey ? t(asset.nameKey, asset.name) : asset.name;
  const assetMeta = asset.metaKey ? t(asset.metaKey, asset.meta) : asset.meta;
  const [audioPreviewStatus, setAudioPreviewStatus] = useState(asset.type === "audio" ? "loading" : "ready");
  const [audioPreviewProgress, setAudioPreviewProgress] = useState(0);
  const [audioPreviewSrc, setAudioPreviewSrc] = useState(asset.type === "audio" && !/^https?:/i.test(mediaSrc) ? mediaSrc : "");
  const audioFallbacksRef = useRef([]);
  const audioFallbackIndexRef = useRef(-1);
  const tryNextAudioFallback = () => {
    const nextIndex = audioFallbackIndexRef.current + 1;
    const nextSrc = audioFallbacksRef.current[nextIndex];
    if (!nextSrc) {
      setAudioPreviewStatus("error");
      return;
    }
    audioFallbackIndexRef.current = nextIndex;
    setAudioPreviewStatus("loading");
    setAudioPreviewProgress(0.03);
    setAudioPreviewSrc(nextSrc);
  };
  useEffect(() => {
    if (asset.type !== "audio" || !/^https?:/i.test(mediaSrc)) return undefined;
    let canceled = false;
    let objectUrl = "";
    setAudioPreviewStatus("loading");
    setAudioPreviewProgress(0);
    setAudioPreviewSrc("");
    audioFallbacksRef.current = [];
    audioFallbackIndexRef.current = -1;
    try {
      const sourceUrl = new URL(mediaSrc);
      const trackId = sourceUrl.searchParams.get("trackid");
      if (trackId && sourceUrl.hostname.endsWith("storage.jamendo.com")) {
        audioFallbacksRef.current = ["mp31", "ogg", "mp32"].map((format) => {
          const fallbackUrl = new URL(sourceUrl);
          fallbackUrl.searchParams.set("format", format);
          return fallbackUrl.toString();
        });
      } else {
        audioFallbacksRef.current = [mediaSrc];
      }
    } catch {
      audioFallbacksRef.current = [mediaSrc];
    }
    getRemoteAssetBlob({ ...asset, src: mediaSrc }, (progress) => {
      if (!canceled) setAudioPreviewProgress(Math.min(0.96, Math.max(0.01, progress || 0)));
    }).then((blob) => {
      if (canceled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setAudioPreviewProgress(0.98);
      setAudioPreviewSrc(objectUrl);
    }).catch((error) => {
      console.warn("Music preview download failed", error);
      if (!canceled) tryNextAudioFallback();
    });
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, mediaSrc]);
  return (
    <div className="asset-preview-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="asset-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-preview-title">
        <header>
          <div>
            <span>{t("assetPreview", "ç´ æé¢„è§ˆ")}</span>
            <strong id="asset-preview-title">{assetDisplayName}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={t("closeAssetPreview", "å…³é—­é¢„è§ˆ")}>
            <X size={20} />
          </button>
        </header>
        <div className={`asset-preview-media type-${asset.type} ${asset.kind === "vector" ? "is-vector" : ""}`}>
          {asset.type === "video" ? (
            <video key={mediaSrc} src={mediaSrc} poster={asset.thumbnail} crossOrigin="anonymous" controls autoPlay playsInline />
          ) : asset.type === "audio" ? (
            <div className="asset-preview-audio">
              <MusicNote size={58} weight="duotone" />
              <strong>{assetDisplayName}</strong>
              {audioPreviewStatus === "loading" ? (
                <div className="asset-preview-audio-loading" role="status" aria-live="polite">
                  <i style={{ "--audio-preview-progress": `${Math.round(audioPreviewProgress * 100)}%` }}>
                    <b>{Math.round(audioPreviewProgress * 100)}%</b>
                  </i>
                  <span>{t("audioPreviewLoading", "æ­£åœ¨åŠ è½½éŸ³ä¹é¢„è§ˆâ€¦")}</span>
                </div>
              ) : null}
              {audioPreviewStatus === "error" ? (
                <div className="asset-preview-audio-error" role="alert">{t("audioPreviewFailed", "éŸ³ä¹é¢„è§ˆåŠ è½½å¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•")}</div>
              ) : null}
              {audioPreviewSrc ? <audio
                className={audioPreviewStatus === "ready" ? "is-ready" : "is-waiting"}
                key={audioPreviewSrc}
                src={audioPreviewSrc}
                controls
                autoPlay
                preload="metadata"
                onLoadedMetadata={() => setAudioPreviewProgress((progress) => Math.max(progress, 0.99))}
                onCanPlay={() => { setAudioPreviewProgress(1); setAudioPreviewStatus("ready"); }}
                onError={tryNextAudioFallback}
              /> : null}
            </div>
          ) : (
            <img src={mediaSrc} alt={assetDisplayName} crossOrigin="anonymous" />
          )}
        </div>
        {assetMeta || asset.blob ? (
          <footer className="asset-preview-footer">
            {assetMeta ? <span>{assetMeta}</span> : <span />}
            {asset.blob ? (
              <button type="button" onClick={() => downloadMediaBlob(asset.blob, asset.name || "asset")}>
                <DownloadSimple size={14} />{t("download", "ä¸‹è½½")}
              </button>
            ) : null}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function LibraryLoadingGrid() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="library-skeleton-card" key={index}>
          <div className="library-skeleton-thumb"><i /></div>
          <span /><small />
        </div>
      ))}
    </>
  );
}

function AssetRow({ asset, selected, t, downloadState }) {
  const [mediaLoaded, setMediaLoaded] = useState(asset.type === "audio");
  const [previewSrc, setPreviewSrc] = useState(asset.thumbnail || asset.src);
  useEffect(() => {
    setPreviewSrc(asset.thumbnail || asset.src);
    setMediaLoaded(asset.type === "audio");
  }, [asset.id, asset.src, asset.thumbnail, asset.type]);
  const handlePreviewError = () => {
    if (previewSrc !== asset.src) {
      setPreviewSrc(asset.src);
      return;
    }
    if (asset.originalSrc && previewSrc !== asset.originalSrc) {
      setPreviewSrc(asset.originalSrc);
      return;
    }
    setMediaLoaded(true);
  };
  return (
    <div className={`asset-card ${asset.kind === "vector" ? "is-vector" : ""} ${selected ? "is-selected" : ""}`}>
      <div className="asset-thumb">
        {!mediaLoaded ? <div className="asset-media-loading" aria-hidden="true"><i /></div> : null}
        {asset.type === "video" ? (
          asset.thumbnail ? <img src={previewSrc} alt="" crossOrigin="anonymous" draggable={false} onLoad={() => setMediaLoaded(true)} onError={handlePreviewError} /> : <video src={asset.src} crossOrigin="anonymous" muted playsInline preload="metadata" draggable={false} onLoadedData={() => setMediaLoaded(true)} onError={() => setMediaLoaded(true)} />
        ) : asset.type === "audio" ? (
          <div className="asset-audio-thumb">
            <MusicNote size={28} weight="duotone" />
          </div>
        ) : (
          <img src={previewSrc} alt="" crossOrigin="anonymous" draggable={false} onLoad={() => setMediaLoaded(true)} onError={handlePreviewError} />
        )}
        <span>
          {asset.type === "audio"
            ? t(asset.kind === "music" ? "libraryAudio" : "assetAudio")
            : asset.type === "video"
              ? t("assetVideo")
              : asset.kind === "vector"
                ? t("libraryVector", "çŸ¢é‡")
                : t("assetImage")}
        </span>
        {downloadState?.status === "loading" ? (
          <div className="asset-download-progress" aria-label={t("libraryPreparingAsset")}>
            <i style={{ "--asset-progress": `${Math.max(8, Math.round((downloadState.progress || 0) * 100))}%` }} />
          </div>
        ) : downloadState?.status === "ready" ? <i className="asset-ready-dot" title={t("libraryAssetReady")} /> : null}
        <span className="asset-preview-hover" aria-hidden="true">
          <PlayCircle size={30} weight="fill" />
          <em>{t("assetPreview", "ç´ æé¢„è§ˆ")}</em>
        </span>
      </div>
      <div>
        <strong>{asset.nameKey ? t(asset.nameKey, asset.name) : asset.name}</strong>
        <span>{asset.metaKey ? t(asset.metaKey, asset.meta) : asset.meta}</span>
      </div>
    </div>
  );
}

export function ToolPanel(props) {
  const {
    project,
    onLoadMomentIntoTimeline,
    activeTool,
    uiLanguage,
    script,
    updateScript,
    segments,
    currentSegmentIndex,
    captionSegments,
    captionTargetDuration,
    selectedCaptionSegment,
    selectedSegmentId,
    setSelectedSegmentId,
    setSelectedAudioSegmentId,
    setSelectedTrack,
    updateCaptionSegmentText,
    toggleCaptionSegmentHidden,
    deleteCaptionSegment,
    seekTo,
    estimatedDuration,
    captionPosition,
    setCaptionPosition,
    captionSize,
    setCaptionSize,
    captionStyle,
    setCaptionStyle,
    setCaptionSegments,
    captionsEnabled,
    setCaptionsEnabled,
    selectedFilterId,
    setSelectedFilterId,
    selectedTransitionId,
    setSelectedTransitionId,
    selectedStickerId,
    setSelectedStickerId,
    handleStickerPointerDown,
    handleStickerClick,
    confirmStickerSelection,
    closeMobilePanel,
    mobilePanelOpen,
    audioBlob,
    audioDuration,
    sourceAudioBlob,
    sourceAudioName,
    sourceAudioDuration,
    sourceAudioVolume,
    sourceAudioLinked,
    setSourceAudioVolume,
    clearSourceAudioTrack,
    generateCaptionsFromSourceAudio,
    isGeneratingCaptions,
    automaticCaptionProgress,
    separateSourceVocals,
    selectedAudioToolTarget,
    separateSelectedAudioVocals,
    vocalSeparationJob,
    analyzeCurrentVisual,
    analyzeEffectVisual,
    openAvatarPanel,
    smartMode,
    setSmartMode,
    openMobileInspector,
    musicBlob,
    musicName,
    musicDuration,
    musicVolume,
    setMusicVolume,
    clearMusicTrack,
    selectedVoice,
    setVoiceTab,
    downloadBlob,
    notify,
    t,
    trOption,
    miganRepair,
    hdRestoration,
    selectedEffectSegment,
    effectAnalysis,
    effectRunning,
    effectProgress,
    effectPhase,
    updateSelectedSubjectEffect,
    removeSelectedSubjectEffect,
    openEffectsInspector,
    openFaceSwapInspector,
    openOpticalFlowInspector,
    openCinematicDepthInspector,
    openPhotoParallaxInspector,
    cinematicDepth,
    photoParallaxDepth,
    effectsPanelMode,
  } = props;
  const [captionFontStatus, setCaptionFontStatus] = useState("");
  const captionFontOptions = useMemo(
    () => getCaptionFontsForLanguage(uiLanguage),
    [uiLanguage],
  );
  const activeCaptionFontId = selectedCaptionSegment?.fontId || captionStyle?.fontId || "default";
  const visibleCaptionFontOptions = useMemo(() => {
    if (captionFontOptions.some((item) => item.id === activeCaptionFontId)) return captionFontOptions;
    return [captionFontOptions[0], getCaptionFont(activeCaptionFontId), ...captionFontOptions.slice(1)]
      .filter((item, index, items) => item && items.findIndex((candidate) => candidate.id === item.id) === index);
  }, [activeCaptionFontId, captionFontOptions]);
  useEffect(() => {
    let canceled = false;
    if (activeCaptionFontId === "default") {
      setCaptionFontStatus("");
      return undefined;
    }
    setCaptionFontStatus("loading");
    ensureCaptionFontLoaded(
      activeCaptionFontId,
      selectedCaptionSegment?.text || "",
    ).then(() => {
      if (!canceled) setCaptionFontStatus("ready");
    }).catch(() => {
      if (!canceled) setCaptionFontStatus("failed");
    });
    return () => {
      canceled = true;
    };
  }, [activeCaptionFontId, selectedCaptionSegment?.text]);
  const selectedCaptionFont = getCaptionFont(activeCaptionFontId);
  const selectCaptionFont = async (fontId) => {
    if (selectedCaptionSegment?.id) {
      setCaptionSegments((items) => items.map((segment) => (
        segment.id === selectedCaptionSegment.id ? { ...segment, fontId } : segment
      )));
    } else {
      setCaptionStyle((style) => ({ ...style, fontId }));
    }
    if (fontId === "default") {
      setCaptionFontStatus("ready");
      return;
    }
    setCaptionFontStatus("loading");
    try {
      await ensureCaptionFontLoaded(
        fontId,
        selectedCaptionSegment?.text || "",
      );
      setCaptionFontStatus("ready");
    } catch {
      setCaptionFontStatus("failed");
    }
  };

  if (activeTool === "caption") {
    return (
      <div className="tool-panel caption-tool-panel">
        <h2>{t("caption")}</h2>
        <p className="tool-helper-copy">{t("captionCanvasHint")}</p>
        <label className="switch-row">
          <input type="checkbox" checked={captionsEnabled} onChange={(event) => setCaptionsEnabled(event.target.checked)} />
          {t("showCaptions")}
        </label>
        <div className="segmented">
          {["top", "middle", "bottom"].map((position) => (
            <button
              className={captionPosition === position ? "is-active" : ""}
              type="button"
              key={position}
              onClick={() => setCaptionPosition(position)}
            >
              {position === "top" ? t("top") : position === "middle" ? t("middle") : t("bottom")}
            </button>
          ))}
        </div>
        <div className={`caption-font-field ${captionFontStatus === "loading" ? "is-loading" : ""}`} aria-busy={captionFontStatus === "loading"}>
          <div className="caption-style-heading">
            <strong>{t("captionFont")}</strong>
            <span>{t("captionFontHint")}</span>
          </div>
          <div className="caption-font-select-wrap">
            <select
              aria-label={t("captionFont")}
              aria-describedby="caption-font-load-status"
              value={activeCaptionFontId}
              onChange={(event) => selectCaptionFont(event.target.value)}
            >
              {visibleCaptionFontOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.id === "default" ? t("captionFontDefault") : item.label}
                </option>
              ))}
            </select>
            <span className="caption-font-select-indicator" aria-hidden="true">
              {captionFontStatus === "loading"
                ? <i className="caption-font-select-loading" />
                : <CaretDown size={15} weight="bold" />}
            </span>
          </div>
          <div
            className="caption-font-preview"
            style={{
              fontFamily: selectedCaptionFont.family
                ? `"${selectedCaptionFont.family}", ${selectedCaptionFont.fallback}`
                : selectedCaptionFont.fallback,
              fontWeight: selectedCaptionFont.weight,
            }}
          >
            {selectedCaptionFont.sample}
          </div>
          {captionFontStatus ? (
            <small id="caption-font-load-status" className={`caption-font-status is-${captionFontStatus}`} aria-live="polite">
              {t(`captionFont${captionFontStatus[0].toUpperCase()}${captionFontStatus.slice(1)}`)}
            </small>
          ) : null}
        </div>
        <div className="slider-field compact-slider">
          <div>
            <label htmlFor="caption-size">{t("fontSize")}</label>
            <span>{captionSize}px</span>
          </div>
          <input
            id="caption-size"
            type="range"
            min="12"
            max="42"
            step="1"
            value={captionSize}
            onChange={(event) => setCaptionSize(Number(event.target.value))}
          />
        </div>
        <div className="caption-style-panel">
          <div className="caption-style-heading"><strong>{t("captionStyle")}</strong><span>{t("captionStyleHint")}</span></div>
          <div className="caption-style-presets">
            <button type="button" className={captionStyle.backgroundOpacity === 0 && captionStyle.borderWidth === 0 ? "is-active" : ""} onClick={() => setCaptionStyle((style) => ({ ...style, effect: "normal", backgroundOpacity: 0, borderWidth: 0, shadowOpacity: 0 }))}>{t("captionPresetNone")}</button>
            {[['normal', t('captionPresetClassic')], ['neon', t('captionPresetNeon')]].map(([effect, label]) => (
              <button key={effect} type="button" className={captionStyle.effect === effect ? "is-active" : ""} onClick={() => setCaptionStyle((style) => ({ ...style, effect, ...(effect === 'neon' ? { backgroundOpacity: 0.18, borderWidth: 1, borderColor: '#35f0dd' } : {}) }))}>{label}</button>
            ))}
          </div>
          <div className="caption-color-row">
            <label>{t("captionTextColor")}<input type="color" value={captionStyle.textColor} onChange={(event) => setCaptionStyle((style) => ({ ...style, textColor: event.target.value }))} /></label>
            <label>{t("captionBackground")}<input type="color" value={captionStyle.backgroundColor} onChange={(event) => setCaptionStyle((style) => ({ ...style, backgroundColor: event.target.value }))} /></label>
            <label>{t("captionBorderColor")}<input type="color" value={captionStyle.borderColor} onChange={(event) => setCaptionStyle((style) => ({ ...style, borderColor: event.target.value }))} /></label>
          </div>
          {[['backgroundOpacity', t('captionOpacity'), 0, 1, 0.05, '%'], ['borderWidth', t('captionBorderWidth'), 0, 8, 1, 'px'], ['radius', t('captionRadius'), 0, 28, 1, 'px'], ['paddingX', t('captionPaddingX'), 0, 52, 1, 'px'], ['paddingY', t('captionPaddingY'), 0, 32, 1, 'px'], ['shadowOpacity', t('captionShadow'), 0, 1, 0.05, '%']].map(([key, label, min, max, step, unit]) => (
            <div className="slider-field compact-slider" key={key}><div><label>{label}</label><span>{unit === '%' ? `${Math.round(captionStyle[key] * 100)}%` : `${captionStyle[key]}${unit}`}</span></div><input type="range" min={min} max={max} step={step} value={captionStyle[key]} onChange={(event) => setCaptionStyle((style) => ({ ...style, [key]: Number(event.target.value) }))} /></div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTool === "smart") {
    const aiCopy = AI_MUSIC_COPY.en;

    if (smartMode === "ai-shorts") {
      return (
        <div className="tool-panel">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(0,0,0,0.15)" }}>
            <button
              type="button"
              onClick={() => setSmartMode("auto-edit")}
              style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", font: "inherit", fontSize: "12px", gap: "4px" }}
            >
              <CaretLeft size={16} />
              <span>Back to Smart Hub</span>
            </button>
          </div>
          <div className="mobile-panel-scroll-body" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
            <AiClipGeneratorPanel
              project={project}
              onLoadMomentIntoTimeline={onLoadMomentIntoTimeline}
              onApplyCaptions={props.onApplyCaptions}
              captionStyle={props.captionStyle}
              hasCaptions={Array.isArray(props.captionSegments) && props.captionSegments.length > 0}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="tool-panel smart-hub-panel">
        <div className="smart-hub-grid" role="tablist" aria-label={t("smartTools")}>
          {[
            ["ai-shorts", Sparkles, "AI Shorts Generator", "Automatically transcribe, detect moments, crop 9:16 and add captions"],
            ["auto-edit", Scissors, t("smartAutoEdit"), t("smartAutoEditHint")],
            ["ai-music", MusicNote, aiCopy.title, aiCopy.hint],
            ["smart-frame", FrameCorners, t("smartFrame"), t("smartFrameHint")],
            ["avatar", PersonSimpleRun, t("smartAvatar"), t("smartAvatarHint")],
          ].map(([id, Icon, title, hint]) => (
            <button className={smartMode === id ? "is-active" : ""} type="button" role="tab" aria-selected={smartMode === id} key={id} onClick={() => {
              setSmartMode(id);
              if (id === "avatar") openAvatarPanel();
              if (id === "ai-music" && window.matchMedia?.("(max-width: 760px)").matches) openMobileInspector?.();
            }}>
              <Icon size={24} weight="duotone" /><strong>{title}</strong><span>{hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeTool === "audio") {
    return (
      <div className="tool-panel audio-tool-panel mobile-panel-scroll-body">
        <h2>{t("audioPanel")}</h2>
        <button
          className="audio-entry-card"
          type="button"
          onClick={() => {
            setSelectedAudioSegmentId?.("");
            setSelectedTrack?.("");
            setVoiceTab("synthesis");
            notify("å·²æ‰“å¼€ AI é…éŸ³");
          }}
        >
          <MicrophoneStage size={24} weight="duotone" />
          <span>
            <strong>{t("aiVoiceEntryTitle")}</strong>
            <em>{t("aiVoiceEntryDesc")}</em>
          </span>
        </button>
        <button
          className="audio-entry-card separation-entry-card"
          type="button"
          disabled={!selectedAudioToolTarget || vocalSeparationJob.running}
          onClick={separateSelectedAudioVocals || separateSourceVocals}
        >
          <Waveform size={24} weight="duotone" />
          <span>
            <strong>{vocalSeparationJob.running ? t("vocalSeparationRunning") : t("vocalSeparationTitle")}</strong>
            <em>{selectedAudioToolTarget ? (vocalSeparationJob.phase || t("vocalSeparationDesc")) : t("vocalSeparationNeedsSource")}</em>
          </span>
          {vocalSeparationJob.running ? <span className="inline-progress" aria-hidden="true"><span style={{ width: `${vocalSeparationJob.progress}%` }} /></span> : null}
        </button>
        <button
          className="audio-entry-card caption-entry-card"
          type="button"
          disabled={!selectedAudioToolTarget || isGeneratingCaptions}
          onClick={() => selectedAudioToolTarget && generateCaptionsFromSourceAudio({
            blob: selectedAudioToolTarget.blob,
            start: selectedAudioToolTarget.start,
            sourceStart: selectedAudioToolTarget.sourceStart,
            duration: selectedAudioToolTarget.duration,
            append: selectedAudioToolTarget.track !== "source",
          })}
        >
          <ClosedCaptioning size={24} weight="duotone" />
          <span>
            <strong>{isGeneratingCaptions ? t("autoCaptionsRunning") : t("autoCaptionsTitle")}</strong>
            <em>{selectedAudioToolTarget ? t("autoCaptionsDesc") : t("autoCaptionsNeedsSource")}</em>
          </span>
          {isGeneratingCaptions ? (
            <span className="inline-progress" aria-hidden="true">
              <span style={{ width: `${automaticCaptionProgress}%` }} />
            </span>
          ) : null}
        </button>
        <div className="metric-list">
          <div>
            <span>{t("currentVoice")}</span>
            <strong>{selectedVoice.name}</strong>
          </div>
          <div>
            <span>{t("voiceDuration")}</span>
            <strong>{formatTime(audioBlob ? audioDuration : 0)}</strong>
          </div>
          <div>
            <span>{t("sourceAudio")}</span>
            <strong>{sourceAudioBlob ? sourceAudioName : t("notSeparated")}</strong>
          </div>
          <div>
            <span>{t("sourceDuration")}</span>
            <strong>{formatTime(sourceAudioBlob ? sourceAudioDuration : 0)}</strong>
          </div>
          <div>
            <span>{t("bgm")}</span>
            <strong>{musicBlob ? musicName : t("notAdded")}</strong>
          </div>
          <div>
            <span>{t("musicDuration")}</span>
            <strong>{formatTime(musicBlob ? musicDuration : 0)}</strong>
          </div>
        </div>
        <div className="slider-field compact-slider">
          <div>
            <label htmlFor="source-audio-volume">{t("sourceAudio")} {t("volume")}</label>
            <span>{Math.round(sourceAudioVolume * 100)}%</span>
          </div>
          <input
            id="source-audio-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sourceAudioVolume}
            disabled={!sourceAudioBlob}
            onInput={(event) => setSourceAudioVolume(Number(event.currentTarget.value))}
            onChange={(event) => setSourceAudioVolume(Number(event.target.value))}
          />
        </div>
        <div className="slider-field compact-slider">
          <div>
            <label htmlFor="music-volume">{t("bgm")} {t("volume")}</label>
            <span>{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            id="music-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={musicVolume}
            onInput={(event) => setMusicVolume(Number(event.currentTarget.value))}
            onChange={(event) => setMusicVolume(Number(event.target.value))}
          />
        </div>
        <div className="audio-download-actions">
          <button
            className="panel-primary"
            type="button"
            disabled={!audioBlob}
            onClick={() => audioBlob && downloadBlob(audioBlob, "ai-voiceover.wav")}
          >
            {t("downloadCurrentWav")}
          </button>
          <button
            className="panel-secondary"
            type="button"
            disabled={!musicBlob}
            onClick={() => musicBlob && downloadBlob(musicBlob, musicName || "background-music.wav")}
          >
            {t("downloadBgm")}
          </button>
          <button
            className="panel-secondary"
            type="button"
            disabled={!sourceAudioBlob}
            onClick={() => sourceAudioBlob && downloadBlob(sourceAudioBlob, sourceAudioName || "source-audio.wav")}
          >
            {t("downloadSource")}
          </button>
        </div>
        <div className="audio-delete-actions">
          <button className="panel-secondary is-danger" type="button" disabled={!sourceAudioBlob} onClick={() => clearSourceAudioTrack()}>
            {t("deleteSource")}
          </button>
          <button className="panel-secondary is-danger" type="button" disabled={!musicBlob} onClick={() => clearMusicTrack()}>
            {t("deleteBgm")}
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "stickers") {
    return (
      <StickerPanel
        title={t("stickers")}
        options={STICKERS}
        selectedId={selectedStickerId}
        trOption={trOption}
        t={t}
        onStickerPointerDown={handleStickerPointerDown}
        onStickerClick={handleStickerClick}
        onStickerConfirm={confirmStickerSelection}
        closeMobilePanel={closeMobilePanel}
        mobilePanelOpen={mobilePanelOpen}
        onSelect={(id) => {
          setSelectedStickerId(id);
          notify(t("stickerApplied"));
        }}
      />
    );
  }

  if (activeTool === "effects") {
    return (
      <SubjectEffectsWorkspace
        t={t}
        segment={selectedEffectSegment}
        analysis={effectAnalysis}
        running={effectRunning}
        progress={effectProgress}
        phase={effectPhase}
        onChange={updateSelectedSubjectEffect}
        onAnalyze={analyzeEffectVisual || analyzeCurrentVisual}
        onOpenInspector={openEffectsInspector}
        onOpenFaceSwap={openFaceSwapInspector}
        onOpenOpticalFlow={openOpticalFlowInspector}
        onOpenCinematicDepth={openCinematicDepthInspector}
        onOpenPhotoParallax={openPhotoParallaxInspector}
        faceSwapActive={effectsPanelMode === "face-swap"}
        opticalFlowActive={effectsPanelMode === "vector-tracking"}
        cinematicDepthActive={effectsPanelMode === "cinematic-depth"}
        cinematicDepthAnalysis={cinematicDepth?.record}
        cinematicDepthRunning={cinematicDepth?.job?.running}
        cinematicDepthProgress={cinematicDepth?.job?.progress}
        photoParallaxActive={effectsPanelMode === "photo-parallax"}
        photoParallaxAnalysis={photoParallaxDepth?.record}
        photoParallaxRunning={photoParallaxDepth?.job?.running}
        photoParallaxProgress={photoParallaxDepth?.job?.progress}
        onRemove={removeSelectedSubjectEffect}
      />
    );
  }

  return (
    <VisualChoicePanel
      title={t("filters")}
      kind="effect"
      options={FILTER_OPTIONS}
      selectedId={selectedFilterId}
      trOption={trOption}
      onSelect={(id) => {
        setSelectedFilterId(id);
        notify(t("filterApplied"));
      }}
    />
  );
}

export function VisualEffectsPanel({
  t,
  segment,
  localTime,
  onChange,
  onSeek,
  onPreviewAnimation,
  selectedFilterId,
  trOption,
  onSelectFilter,
  contextMode = false,
  sourceAudioLinked = false,
  miganRepair = null,
  hdRestoration = null,
  mode = "main",
  vectorEditor = null,
  onApplyPreset = null,
  onDelete = null,
  onCanvasEditModeChange,
  requestedTab = "",
  singleSection = "",
}) {
  const [activeTab, setActiveTab] = useState("transform");
  const [tabEdges, setTabEdges] = useState({ atStart: true, atEnd: false });
  const tabsRef = useRef(null);
  const [animationSection, setAnimationSection] = useState("in");
  const [hoveredAnimation, setHoveredAnimation] = useState(null);
  const keyframes = normalizeVisualKeyframes(segment?.keyframes ?? []);
  const transform = resolveVisualTransform(keyframes, localTime, segment?.baseTransform);
  const mask = segment?.mask ?? { type: "none", feather: 0, inverted: false };
  const hasMask = mask.type && mask.type !== "none";
  const isCircleMask = mask.type === "circle";
  const isVideo = segment?.type === "video";
  const isVector = segment?.kind === "vector" || Boolean(segment?.vectorBody);
  const isOverlay = mode === "overlay";
  const playbackRate = Math.max(0.25, Math.min(4, Number(segment?.playbackRate) || 1));
  const clipAnimation = normalizeVisualClipAnimation(segment?.animation);
  const activeAnimation = clipAnimation[animationSection];
  const sourceDuration = Math.max(0, Number(segment?.sourceDuration) || (Number(segment?.duration) || 0) * playbackRate);
  const updateTransform = (key, value) => onChange?.(
    hasVisualPropertyKeyframe(keyframes, localTime, key)
      ? { propertyKeyframe: { time: localTime, key, value } }
      : { baseTransform: { [key]: value } },
  );
  const tabLabels = {
    transform: t("visualTabTransform"),
    mask: t("visualTabMask"),
    filters: t("visualTabEffects"),
    animation: t("visualTabAnimation"),
    speed: t("visualTabSpeed"),
    vector: t("vectorProperties"),
    timing: t("overlayTiming", "Timing & layer"),
    repair: t("repairTab"),
  };
  const tabs = getVisualPropertyTabIds({
    isVector,
    isVideo,
    isOverlay,
    hasVectorEditor: Boolean(vectorEditor),
  }).map((id) => [id, tabLabels[id]]);
  const updateTabEdges = useCallback(() => {
    const node = tabsRef.current;
    if (!node) return;
    setTabEdges({
      atStart: node.scrollLeft <= 6,
      atEnd: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2,
    });
  }, []);
  const scrollVisualTabs = (direction) => {
    const node = tabsRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.max(148, node.clientWidth * 0.68),
      behavior: "smooth",
    });
  };
  useEffect(() => {
    if (!tabs.some(([id]) => id === activeTab)) setActiveTab(tabs[0]?.[0] || "transform");
  }, [activeTab, isOverlay, isVector, isVideo, vectorEditor]);
  useEffect(() => {
    const nextTab = tabs.some(([id]) => id === requestedTab) ? requestedTab : "transform";
    setActiveTab(nextTab);
    onCanvasEditModeChange?.(nextTab === "mask" ? "mask" : "transform");
  }, [mode, onCanvasEditModeChange, requestedTab, segment?.id]);
  useEffect(() => {
    onCanvasEditModeChange?.(activeTab === "mask" ? "mask" : "transform");
  }, [activeTab, onCanvasEditModeChange]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = tabsRef.current;
      const activeButton = node?.querySelector('[aria-selected="true"]');
      if (node && activeButton) {
        const start = activeButton.offsetLeft;
        const end = start + activeButton.offsetWidth;
        if (start < node.scrollLeft + 4) node.scrollTo({ left: Math.max(0, start - 4), behavior: "smooth" });
        else if (end > node.scrollLeft + node.clientWidth - 28) {
          node.scrollTo({ left: end - node.clientWidth + 28, behavior: "smooth" });
        }
      }
      requestAnimationFrame(updateTabEdges);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, segment?.id, updateTabEdges]);
  useEffect(() => {
    if (!hoveredAnimation || !segment || !onPreviewAnimation) return undefined;
    let frame = 0;
    let lastPaint = 0;
    const startedAt = performance.now();
    const paint = (now) => {
      if (now - lastPaint >= 32) {
        const phaseProgress = ((now - startedAt) % 1100) / 900;
        const progress = Math.min(1, phaseProgress);
        const previewAnimation = {
          ...clipAnimation,
          [hoveredAnimation.phase]: {
            id: hoveredAnimation.id,
            duration: DEFAULT_VISUAL_ANIMATION_DURATION,
          },
        };
        const previewLocalTime = hoveredAnimation.phase === "in"
          ? progress * DEFAULT_VISUAL_ANIMATION_DURATION
          : Math.max(0, Number(segment.duration) - DEFAULT_VISUAL_ANIMATION_DURATION + progress * DEFAULT_VISUAL_ANIMATION_DURATION);
        onPreviewAnimation({ segmentId: segment.id, animation: previewAnimation, localTime: previewLocalTime });
        lastPaint = now;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      onPreviewAnimation(null);
    };
  }, [hoveredAnimation, onPreviewAnimation, segment?.id, segment?.duration]);
  return (
    <div className={`tool-panel visual-effects-panel ${contextMode ? "is-context-mode" : ""} ${singleSection ? "is-single-section" : ""}`}>
      {!contextMode ? <h2>{t("imageTrack")}</h2> : null}
      {!segment ? <div className="empty-state">{t("visualSelectClip")}</div> : <>
        {!singleSection ? <div className={`visual-context-tabs-shell ${tabEdges.atStart ? "" : "has-left-shadow"} ${tabEdges.atEnd ? "" : "has-right-shadow"}`}>
          {!tabEdges.atStart ? (
            <button
              className="visual-context-tabs-arrow is-left"
              type="button"
              aria-label={t("visualTabsPrevious")}
              title={t("visualTabsPrevious")}
              onClick={() => scrollVisualTabs(-1)}
            >
              <CaretLeft size={16} weight="bold" />
            </button>
          ) : null}
          <div
            ref={tabsRef}
            className="visual-context-tabs"
            role="tablist"
            aria-label={t("imageTrack")}
            onScroll={updateTabEdges}
          >{tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "is-active" : ""} key={id} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
          {!tabEdges.atEnd ? (
            <button
              className="visual-context-tabs-arrow is-right"
              type="button"
              aria-label={t("visualTabsNext")}
              title={t("visualTabsNext")}
              onClick={() => scrollVisualTabs(1)}
            >
              <CaretRight size={16} weight="bold" />
            </button>
          ) : null}
        </div> : null}
        {activeTab === "transform" ?
        <section className="visual-editor-card">
          <div className="visual-editor-heading"><span><Diamond size={16} weight="fill" />{t("visualKeyframes")}</span><em>{localTime.toFixed(2)}s Â· {keyframes.length} {t("visualFrames")}</em></div>
          <button className="panel-secondary visual-add-all-keyframes" type="button" onClick={() => onChange?.({ keyframe: { time: localTime, ...transform } })}><Diamond size={14} weight="fill" />{t("visualAddAllKeyframes")}</button>
          {keyframes.length ? <div className="visual-keyframe-times" aria-label={t("visualKeyframes")}>{keyframes.map((frame) => <button type="button" aria-label={`${frame.time.toFixed(2)}s Â· ${t("visualKeyframes")}`} className={Math.abs(frame.time - localTime) <= 0.04 ? "is-current" : ""} key={frame.time} onClick={() => onSeek?.(frame.time)}>{frame.time.toFixed(2)}s</button>)}</div> : null}
          {[['scale', t('visualScale'), 0.2, 3, 0.01, 100], ['x', t('visualPositionX'), -100, 100, 1, 1], ['y', t('visualPositionY'), -100, 100, 1, 1], ['rotation', t('visualRotation'), -180, 180, 1, 1], ['opacity', t('visualOpacity'), 0, 1, 0.01, 100]].map(([key, label, min, max, step, displayScale]) => {
            const keyed = hasVisualPropertyKeyframe(keyframes, localTime, key);
            const displayValue = Math.round(transform[key] * displayScale * 100) / 100;
            return <div className="slider-field compact-slider visual-keyframe-property" key={key}><div><label>{label}</label><span className="visual-property-value"><label className="visual-number-field"><input aria-label={`${label} Â· ${t("visualKeyframes")}`} type="number" min={min * displayScale} max={max * displayScale} step={step * displayScale} value={displayValue} onChange={(event) => updateTransform(key, Number(event.target.value) / displayScale)} /><i>{key === 'rotation' ? 'Â°' : '%'}</i></label><button className={keyed ? "is-active" : ""} type="button" aria-label={`${keyed ? t("visualRemovePropertyKeyframe") : t("visualAddPropertyKeyframe")} Â· ${label}`} onClick={() => keyed ? onChange?.({ removePropertyKeyframe: { time: localTime, key } }) : onChange?.({ propertyKeyframe: { time: localTime, key, value: transform[key] } })}><Diamond size={13} weight={keyed ? "fill" : "regular"} /></button></span></div><input aria-label={`${label} Â· slider`} type="range" min={min} max={max} step={step} value={transform[key]} onChange={(event) => updateTransform(key, Number(event.target.value))} /></div>;
          })}
          <button className="panel-secondary" type="button" onClick={() => onChange?.({ removeKeyframeAt: localTime })}>{t("visualDeleteKeyframe")}</button>
        </section> : null}
        {activeTab === "mask" ?
        <section className="visual-editor-card">
          {!singleSection ? <div className="visual-editor-heading"><strong>{t("visualMask")}</strong><em>{t("visualClipScoped")}</em></div> : null}
          <div className="mask-choice-grid">{[['none',t('visualMaskNone')],['rectangle',t('visualMaskRectangle')],['rounded',t('visualMaskRounded')],['circle',t('visualMaskCircle')]].map(([id,label]) => <button type="button" key={id} className={mask.type === id ? 'is-active' : ''} onClick={() => onChange?.({ mask: { ...mask, type: id, ...(id === 'circle' && !Number.isFinite(mask.size) ? { size: 72 } : {}), ...(id === 'rounded' && !Number.isFinite(mask.cornerRadius) ? { cornerRadius: 12 } : {}) } })}>{label}</button>)}</div>
          {hasMask ? <>
            <div className="slider-field compact-slider"><div><label>{t("visualFeather")}</label><span>{mask.feather || 0}%</span></div><input type="range" min="0" max="40" value={mask.feather || 0} onChange={(event) => onChange?.({ mask: { ...mask, feather: Number(event.target.value) } })} /></div>
            {[['centerX',t('visualHorizontal'),0,100,50],['centerY',t('visualVertical'),0,100,50]].map(([key,label,min,max,fallback]) => <div className="slider-field compact-slider" key={key}><div><label>{label}</label><span>{Number.isFinite(mask[key]) ? Math.round(mask[key]) : fallback}%</span></div><input type="range" min={min} max={max} value={Number.isFinite(mask[key]) ? mask[key] : fallback} onChange={(event) => onChange?.({ mask: { ...mask, [key]: Number(event.target.value) } })} /></div>)}
            {isCircleMask ? <div className="slider-field compact-slider"><div><label>{t("visualDiameter")}</label><span>{Number.isFinite(mask.size) ? Math.round(mask.size) : 72}%</span></div><input type="range" min="8" max="100" value={Number.isFinite(mask.size) ? mask.size : 72} onChange={(event) => onChange?.({ mask: { ...mask, size: Number(event.target.value) } })} /></div> : [['width',t('visualWidth'),8,100,80],['height',t('visualHeight'),8,100,80]].map(([key,label,min,max,fallback]) => <div className="slider-field compact-slider" key={key}><div><label>{label}</label><span>{Number.isFinite(mask[key]) ? Math.round(mask[key]) : fallback}%</span></div><input type="range" min={min} max={max} value={Number.isFinite(mask[key]) ? mask[key] : fallback} onChange={(event) => onChange?.({ mask: { ...mask, [key]: Number(event.target.value) } })} /></div>)}
            {mask.type === "rounded" ? <div className="slider-field compact-slider"><div><label>{t("visualCornerRadius")}</label><span>{Number.isFinite(mask.cornerRadius) ? Math.round(mask.cornerRadius) : 12}%</span></div><input type="range" min="0" max="50" value={Number.isFinite(mask.cornerRadius) ? mask.cornerRadius : 12} onChange={(event) => onChange?.({ mask: { ...mask, cornerRadius: Number(event.target.value) } })} /></div> : null}
            <label className="switch-row"><input type="checkbox" checked={Boolean(mask.inverted)} onChange={(event) => onChange?.({ mask: { ...mask, inverted: event.target.checked } })} />{t("visualInvertMask")}</label>
          </> : <p className="mask-empty-hint">{t("visualMaskNoneHint")}</p>}
        </section> : null}
        {activeTab === "speed" ? <section className="visual-editor-card visual-speed-card">
          {!singleSection ? <div className="visual-editor-heading"><strong>{t("visualSpeed")}</strong><em>{t("visualClipScoped")}</em></div> : null}
          {isVideo ? <>
            <div className="visual-speed-presets" aria-label={t("visualSpeed")}>{[0.25, 0.5, 1, 1.5, 2, 3, 4].map((rate) => <button type="button" className={Math.abs(playbackRate - rate) < 0.001 ? "is-active" : ""} key={rate} onClick={() => onChange?.({ playbackRate: rate })}>{rate}Ã—</button>)}</div>
            <div className="slider-field compact-slider"><div><label>{t("visualSpeed")}</label><strong>{playbackRate.toFixed(playbackRate % 1 ? 2 : 0)}Ã—</strong></div><input aria-label={t("visualSpeed")} type="range" min="0.25" max="4" step="0.05" value={playbackRate} onChange={(event) => onChange?.({ playbackRate: Number(event.target.value) })} /></div>
            <div className="visual-speed-summary"><span><em>{t("visualSourceDuration")}</em><strong>{sourceDuration.toFixed(2)}s</strong></span><span><em>{t("visualTimelineDuration")}</em><strong>{Number(segment.duration).toFixed(2)}s</strong></span></div>
            <p className="visual-speed-hint">{sourceAudioLinked ? t("sourceAudioSynced") : t("visualSpeedVisualOnlyHint")}</p>
          </> : <div className="empty-state visual-speed-empty">{t("visualSpeedImageHint")}</div>}
        </section> : null}
        {activeTab === "filters" ? <VisualChoicePanel title={t("visualEffects")} hideTitle={Boolean(singleSection)} previewImage={segment?.src} kind="filter" options={FILTER_OPTIONS} selectedId={selectedFilterId} trOption={trOption} onSelect={onSelectFilter} /> : null}
        {activeTab === "animation" ? <section className="visual-editor-card visual-animation-card">
          {!singleSection ? <div className="visual-editor-heading"><strong>{t("visualAnimation")}</strong><em>{t("visualAnimationHoverHint")}</em></div> : null}
          <div className="visual-animation-sections" role="tablist" aria-label={t("visualAnimation")}>
            {[['in', t('visualAnimationIn')], ['out', t('visualAnimationOut')]].map(([id, label]) => <button type="button" role="tab" aria-selected={animationSection === id} className={animationSection === id ? 'is-active' : ''} key={id} onClick={() => setAnimationSection(id)}>{label}</button>)}
          </div>
          <div className="visual-animation-grid">
            {VISUAL_CLIP_ANIMATION_OPTIONS.map((option) => <button
              type="button"
              className={activeAnimation.id === option.id ? "is-active" : ""}
              key={option.id}
              onPointerEnter={() => option.id !== "none" && setHoveredAnimation({ phase: animationSection, id: option.id })}
              onPointerLeave={() => setHoveredAnimation(null)}
              onFocus={() => option.id !== "none" && setHoveredAnimation({ phase: animationSection, id: option.id })}
              onBlur={() => setHoveredAnimation(null)}
              onClick={() => onChange?.({ animation: { ...clipAnimation, [animationSection]: { ...activeAnimation, id: option.id } } })}
            ><span className={`visual-animation-swatch is-${option.id}`} aria-hidden="true"><i /></span><strong>{t(option.labelKey)}</strong></button>)}
          </div>
          {activeAnimation.id !== "none" ? <div className="slider-field compact-slider visual-animation-duration"><div><label>{t("visualAnimationDuration")}</label><strong>{activeAnimation.duration.toFixed(1)}s</strong></div><input aria-label={t("visualAnimationDuration")} type="range" min="0.1" max={Math.min(3, Math.max(0.1, Number(segment.duration) || 0.1))} step="0.1" value={activeAnimation.duration} onChange={(event) => onChange?.({ animation: { ...clipAnimation, [animationSection]: { ...activeAnimation, duration: Number(event.target.value) } } })} /></div> : null}
        </section> : null}
        {activeTab === "vector" ? <section className="visual-editor-card visual-vector-card">{vectorEditor}</section> : null}
        {activeTab === "timing" ? <section className="visual-editor-card visual-overlay-timing-card">
          {!singleSection ? <div className="visual-editor-heading"><strong>{t("overlayTiming", "Timing & layer")}</strong><em>{t("visualClipScoped")}</em></div> : null}
          <section className="visual-overlay-presets"><strong>{t("layoutPresets")}</strong><div>
            {[["top-left", "â†–"], ["top-right", "â†—"], ["bottom-left", "â†™"], ["bottom-right", "â†˜"], ["center", "â—"], ["full", "â–¡"]].map(([id, label]) => <button type="button" key={id} title={id} aria-label={`${t("layoutPresets")} ${id}`} onClick={() => onApplyPreset?.(id)}>{label}</button>)}
          </div></section>
          <label><span>{t("clipStart", "Start time")}</span><input type="number" min="0" step="0.1" value={segment.start} onChange={(event) => onChange?.({ timing: { start: Math.max(0, Number(event.target.value) || 0) } })} /></label>
          <label><span>{t("clipDuration", "Duration")}</span><input type="number" min="0.1" step="0.1" value={segment.duration} onChange={(event) => onChange?.({ timing: { duration: Math.max(0.1, Number(event.target.value) || 0.1) } })} /></label>
          <label><span>{t("layer", "Layer")}</span><input type="number" min="1" step="1" value={segment.layer || 1} onChange={(event) => onChange?.({ timing: { layer: Math.max(1, Math.round(Number(event.target.value) || 1)) } })} /></label>
          {isVideo ? <label className="switch-row"><input type="checkbox" checked={segment.muted === true} onChange={(event) => onChange?.({ timing: { muted: event.target.checked } })} />{t("overlayMute", "Mute video audio")}</label> : null}
          <button className="panel-secondary visual-overlay-delete" type="button" onClick={onDelete}><Trash size={14} />{t("delete")}</button>
        </section> : null}
        {activeTab === "repair" ? <section className="visual-editor-card repair-card repair-hub">
          {!singleSection ? <div className="visual-editor-heading">
            <span><MagicWand size={17} weight="duotone" />{t("repairHubTitle")}</span>
            <em>{t("repairLocalBadge")}</em>
          </div> : null}
          <div className={`repair-hub-summary ${singleSection ? "is-focused" : ""}`}>
            <p className="repair-intro">{t("repairHubIntro")}</p>
            {singleSection ? <em>{t("repairLocalBadge")}</em> : null}
          </div>
          <div className="repair-capability-list">
            <article className="repair-capability is-available">
              <span><MagicWand size={18} weight="duotone" /></span>
              <div><strong>{t("repairWatermarkCapability")}</strong><small>{t("repairWatermarkCapabilityHint")}</small></div>
              <button className="panel-primary" type="button" onClick={miganRepair?.openDialog}>{segment?.repair ? t("repairEditAgain") : t("repairOpenEditor")}</button>
            </article>
            <article className="repair-capability is-available">
              <span><Scan size={18} weight="duotone" /></span>
              <div><strong>{t("repairHdCapability")}</strong><small>{t("repairHdCapabilityHint")}</small></div>
              <button className="panel-primary" type="button" onClick={hdRestoration?.openDialog}>{segment?.enhancement?.mode === "nanovsr-644k" ? t("repairEditAgain") : t("repairOpenEditor")}</button>
            </article>
          </div>
          {segment?.repair ? <label className="switch-row repair-result-toggle"><input type="checkbox" checked={segment.repair.enabled !== false} onChange={(event) => onChange?.({ repairEnabled: event.target.checked })} />{t("repairUseResult")}</label> : null}
          {segment?.enhancement?.mode === "nanovsr-644k" ? <label className="switch-row repair-result-toggle"><input type="checkbox" checked={segment.enhancement.enabled !== false} onChange={(event) => onChange?.({ enhancementEnabled: event.target.checked })} />{t("hdRestoreUseResult")}</label> : null}
        </section> : null}
      </>}
    </div>
  );
}

function VisualChoicePanel({ title, hideTitle = false, previewImage = SAMPLE_IMAGE, kind, options, selectedId, trOption = (name) => name, onSelect }) {
  return (
    <div className="tool-panel">
      {!hideTitle ? <h2>{title}</h2> : null}
      <div className="visual-choice-grid">
        {options.map((option) => (
          <button
            className={`visual-choice-card is-${kind} preview-${option.id} ${
              selectedId === option.id ? "is-selected" : ""
            }`}
            type="button"
            key={option.id}
            draggable={option.id !== "none"}
            style={{
              "--choice-image": `url(${previewImage || SAMPLE_IMAGE})`,
              "--choice-filter": option.css ?? "none",
            }}
            onClick={() => onSelect(option.id)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("application/x-timeline-visual-style", `${kind}:${option.id}`);
              event.dataTransfer.setData("text/plain", `visual-style:${kind}:${option.id}`);
            }}
          >
            <span className="visual-choice-thumb" aria-hidden="true" />
            <span className="visual-choice-label">
              <span>{trOption(option.name, option)}</span>
              {selectedId === option.id ? <Check size={14} weight="bold" /> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoicePanel({ title, options, selectedId, trOption = (name) => name, onSelect }) {
  return (
    <div className="tool-panel">
      <h2>{title}</h2>
      <div className="choice-list">
        {options.map((option) => (
          <button className={selectedId === option.id ? "is-selected" : ""} type="button" key={option.id} onClick={() => onSelect(option.id)}>
            <span>{trOption(option.name, option)}</span>
            {selectedId === option.id ? <Check size={16} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function StickerPanel({
  title,
  options,
  selectedId,
  trOption = (name) => name,
  onSelect,
  t,
  onStickerPointerDown,
  onStickerClick,
  onStickerConfirm,
  closeMobilePanel,
  mobilePanelOpen,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(STICKER_PAGE_SIZE);
  const loadMoreRef = useRef(null);
  const emptySticker = options.find((option) => option.id === "none") ?? { id: "none", name: "æ— è´´çº¸" };
  const stickerOptions = useMemo(() => options.filter((option) => option.id !== "none"), [options]);
  const filteredStickers = useMemo(
    () =>
      activeCategory === "all"
        ? stickerOptions
        : stickerOptions.filter((option) => option.category === activeCategory),
    [activeCategory, stickerOptions],
  );
  const visibleStickers = filteredStickers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredStickers.length;
  const selectedSticker = stickerOptions.find((option) => option.id === selectedId) ?? null;

  useEffect(() => {
    setVisibleCount(STICKER_PAGE_SIZE);
  }, [activeCategory]);

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setVisibleCount((count) => Math.min(count + STICKER_PAGE_SIZE, filteredStickers.length));
      },
      { root: null, rootMargin: "120px 0px" },
    );
    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [filteredStickers.length, hasMore]);

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + STICKER_PAGE_SIZE, filteredStickers.length));
  };

  return (
    <div className="tool-panel sticker-panel">
      <h2>{title}</h2>
      <button
        className={`sticker-none-button ${selectedId === emptySticker.id ? "is-selected" : ""}`}
        type="button"
        onClick={() => onSelect(emptySticker.id)}
      >
        <span>{trOption(emptySticker.name, emptySticker)}</span>
        {selectedId === emptySticker.id ? <Check size={15} weight="bold" /> : null}
      </button>
      <div className="sticker-category-row" role="tablist" aria-label={t("stickerCategories")}>
        {STICKER_CATEGORIES.map((category) => (
          <button
            className={activeCategory === category.id ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={activeCategory === category.id}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
          >
            {trOption(category.name, category)}
          </button>
        ))}
      </div>
      <div className="sticker-grid" aria-live="polite">
        {visibleStickers.map((option) => {
          const dragAsset = {
            ...option,
            type: "sticker",
            meta: "è´´çº¸",
          };

          return (
          <button
            className={`sticker-tile ${selectedId === option.id ? "is-selected" : ""}`}
            type="button"
            key={option.id}
            onPointerDown={(event) => onStickerPointerDown?.(event, dragAsset)}
            onClick={(event) => {
              if (onStickerClick) {
                onStickerClick(event, option);
                return;
              }
              onSelect(option.id);
            }}
          >
            <span className="sticker-tile-thumb" aria-hidden="true">
              <img src={option.src} alt="" loading="lazy" draggable={false} />
            </span>
            <span className="sticker-tile-label">
              <span>{trOption(option.name, option)}</span>
              {selectedId === option.id ? <Check size={13} weight="bold" /> : null}
            </span>
          </button>
          );
        })}
      </div>
      {hasMore ? (
        <button className="sticker-load-more" type="button" ref={loadMoreRef} onClick={loadMore}>
          <span>{t("loadMoreStickers")}</span>
          <span>
            {visibleStickers.length}/{filteredStickers.length}
          </span>
        </button>
      ) : (
        <span className="sticker-load-sentinel" ref={loadMoreRef} aria-hidden="true" />
      )}
      {mobilePanelOpen ? createPortal((
        <div className="mobile-sticker-actions" aria-label={t("mobileStickerActions")}>
          <button type="button" className="is-secondary" onClick={() => {
            onSelect(emptySticker.id);
            closeMobilePanel?.();
          }}>{t("mobileStickerCancel")}</button>
          <button type="button" disabled={!selectedSticker} onClick={() => {
            if (!selectedSticker) return;
            onStickerConfirm?.(selectedSticker);
            closeMobilePanel?.();
          }}>{t("addSticker")}</button>
        </div>
      ), document.body) : null}
    </div>
  );
}

export function VoiceSynthesisPanel({
  script,
  updateScript,
  selectedVoiceId,
  setSelectedVoiceId,
  selectedVoice,
  filteredVoices,
  voiceFilter,
  setVoiceFilter,
  showVoiceFilter,
  setShowVoiceFilter,
  speed,
  setSpeed,
  volume,
  setVolume,
  status,
  statusText,
  progressPercent,
  audioBlob,
  audioUrl,
  generateVoiceover,
  downloadBlob,
  favoriteVoiceIds,
  setFavoriteVoiceIds,
  voiceProfiles,
  selectedVoiceProfileId,
  setSelectedVoiceProfileId,
  toggleVoiceProfileFavorite,
  selectedVoiceProfile,
  clearSelectedVoiceProfile,
  t,
}) {
  const voiceLanguages = useMemo(() => [...new Set(VOICES.map((voice) => voice.language))], []);
  const voiceSampleRef = useRef(null);
  const previousVoiceSampleIdRef = useRef(selectedVoiceId);
  const cloneSampleUrl = useMemo(
    () => selectedVoiceProfile?.testBlob ? URL.createObjectURL(selectedVoiceProfile.testBlob) : "",
    [selectedVoiceProfile],
  );

  useEffect(() => () => { if (cloneSampleUrl) URL.revokeObjectURL(cloneSampleUrl); }, [cloneSampleUrl]);

  const selectAndPlayVoiceSample = (voice, preserveClone = false) => {
    if (!preserveClone) clearSelectedVoiceProfile();
    if (voice.id !== selectedVoiceId) setSpeed(voice.defaultSpeed ?? 1);
    previousVoiceSampleIdRef.current = voice.id;
    flushSync(() => setSelectedVoiceId(voice.id));
    const player = voiceSampleRef.current;
    if (!player) return;
    player.pause();
    player.load();
    delete player.dataset.autoplayStarted;
    delete player.dataset.autoplayError;
    player.play()
      .then(() => { player.dataset.autoplayStarted = "true"; })
      .catch((error) => { player.dataset.autoplayError = error.name || "PlaybackError"; });
  };

  const selectCloneProfile = (profile) => {
    flushSync(() => setSelectedVoiceProfileId(profile.id));
    setVolume((current) => Math.abs(current - 1) < 0.001 ? 1.2 : current);
    const player = voiceSampleRef.current;
    if (player) { player.pause(); player.load(); }
  };

  useEffect(() => {
    const player = voiceSampleRef.current;
    if (!player) return;
    if (previousVoiceSampleIdRef.current === selectedVoiceId) return;
    previousVoiceSampleIdRef.current = selectedVoiceId;
    player.pause();
    player.load();
  }, [selectedVoiceId]);

  return (
    <>
      <label className="field-label" htmlFor="script-input">
        {t("inputScript")}
      </label>
      <div className="script-box">
        <textarea id="script-input" value={script} maxLength={5000} onChange={(event) => updateScript(event.target.value)} />
        <div className="script-meta">
          <button type="button" onClick={() => updateScript("")}>
            <Trash size={14} />
            {t("clear")}
          </button>
          <span>{script.length} / 5000</span>
        </div>
      </div>

      <div className="voice-header">
        <label className="field-label">{t("chooseVoice")}</label>
        <div className="menu-anchor">
          <button className="voice-filter" type="button" onClick={() => setShowVoiceFilter((open) => !open)}>
            {voiceFilter === "all" ? t("allVoices") : voiceFilter} <CaretDown size={14} />
          </button>
          {showVoiceFilter ? (
            <Popover closeLabel={t("close")} onClose={() => setShowVoiceFilter(false)}>
              <div className="menu-list">
                {["all", ...voiceLanguages].map((filter) => (
                  <button
                    type="button"
                    className={voiceFilter === filter ? "is-selected" : ""}
                    key={filter}
                    onClick={() => {
                      setVoiceFilter(filter);
                      if (filter !== "all") {
                        const firstVoiceForLanguage = VOICES.find((voice) => voice.language === filter);
                        if (firstVoiceForLanguage) selectAndPlayVoiceSample(firstVoiceForLanguage, true);
                      }
                      setShowVoiceFilter(false);
                    }}
                  >
                    {filter === "all" ? t("allVoices") : filter}
                  </button>
                ))}
              </div>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="voice-list">
        {voiceProfiles.map((profile) => (
          <button
            className={`voice-card clone-voice-card ${profile.id === selectedVoiceProfileId ? "is-selected" : ""}`}
            type="button"
            key={profile.id}
            onClick={() => selectCloneProfile(profile)}
          >
            <span className="avatar"><Waveform size={17} weight="bold" /></span>
            <span>
              <strong>{profile.name}</strong>
              <em>{t("cloneVoiceMultilingual", "å¤šè¯­è¨€ Â· å…‹éš†éŸ³è‰²")}</em>
            </span>
            <small>{t("cloneVoiceBadge", "å…‹éš†")}</small>
          </button>
        ))}
        {filteredVoices.map((voice) => (
          <button
            className={`voice-card ${voice.id === selectedVoiceId && !selectedVoiceProfile ? "is-selected" : ""}`}
            type="button"
            key={voice.id}
            onClick={() => selectAndPlayVoiceSample(voice)}
          >
            <span className="avatar">
              <MicrophoneStage size={17} weight="fill" />
            </span>
            <span>
              <strong>{voice.name}</strong>
              <em>
                {voice.language} Â· {voice.gender}
              </em>
            </span>
            <small>{voice.badge}</small>
          </button>
        ))}
      </div>

      <div className="model-row">
        <span title={selectedVoice.detail}>{selectedVoiceProfile ? `${t("cloneBaseVoice", "åŸºç¡€è¯­è¨€å£°éŸ³")} Â· ${selectedVoice.name}` : selectedVoice.detail}</span>
        <button
          type="button"
          onClick={() => selectedVoiceProfile
            ? toggleVoiceProfileFavorite(selectedVoiceProfile.id)
            : setFavoriteVoiceIds((ids) => ids.includes(selectedVoiceId) ? ids.filter((id) => id !== selectedVoiceId) : [...ids, selectedVoiceId])}
        >
          {selectedVoiceProfile
            ? selectedVoiceProfile.favorite ? t("saved") : t("favorite")
            : favoriteVoiceIds.includes(selectedVoiceId) ? t("saved") : t("favorite")}
        </button>
      </div>

      <div className="voice-sample-preview">
        <div>
          <strong>{t("voiceSampleTitle", "éŸ³è‰²æ ·éŸ³")}</strong>
          <span>{selectedVoiceProfile
            ? `${selectedVoiceProfile.name} Â· ${t("cloneLanguageFlow", "å…ˆåˆæˆæ‰€é€‰è¯­è¨€ï¼Œå†è½¬æ¢ä¸ºæ­¤éŸ³è‰²")}`
            : `${selectedVoice.name} Â· ${t("voiceSampleHint", "åˆ‡æ¢éŸ³è‰²åŽè¯•å¬å¯¹åº”çš„é¢„ç”Ÿæˆæ ·éŸ³")}`}</span>
        </div>
        <audio
          ref={voiceSampleRef}
          data-testid="voice-sample-player"
          data-voice-id={selectedVoiceProfile?.id || selectedVoice.id}
          controls
          preload="metadata"
          src={cloneSampleUrl || selectedVoice.sampleUrl}
        />
      </div>

      <div className="slider-field">
        <div>
          <label htmlFor="speed">{t("speed")}</label>
          <span>{speed.toFixed(2)} x</span>
        </div>
        <input id="speed" type="range" min="0.7" max="1.3" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
      </div>

      <div className="slider-field">
        <div>
          <label htmlFor="volume">{t("volume")}</label>
          <span>{Math.round(volume * 100)}%</span>
        </div>
        <input id="volume" type="range" min="0" max="4" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        {volume > 1 ? <small className="voice-gain-hint">{t("voiceGainLimiterHint", "é«˜å¢žç›Šå·²å¯ç”¨é™å¹…ä¿æŠ¤")}</small> : null}
      </div>

      {status === "generating" ? (
        <div className="voice-generation-loading" role="status" aria-live="polite">
          <i className="voice-generation-spinner" aria-hidden="true" />
          <div>
            <strong>{statusText || t("generating")}</strong>
            <span>{t("ttsFirstRunHint")}</span>
          </div>
          <em>{Math.round(progressPercent)}%</em>
          <div className="progress-track" aria-label={t("generationProgress")}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="voice-actions">
        <button className="generate-button" type="button" disabled={status === "generating" || !script.trim()} onClick={generateVoiceover}>
          {status === "generating" ? <i className="generate-button-spinner" aria-hidden="true" /> : <Waveform size={18} weight="bold" />}
          {status === "generating" ? t("generating") : audioBlob ? t("regenerateVoice") : t("generateVoice")}
        </button>
        <button className="secondary-download" type="button" disabled={!audioBlob} onClick={() => audioBlob && downloadBlob(audioBlob, "ai-voiceover.wav")}>
          <DownloadSimple size={17} />
        </button>
      </div>
      {audioBlob && audioUrl ? (
        <div className="generated-voice-result" aria-live="polite">
          <div><Check size={18} weight="bold" /><span><strong>{t("voiceAddedToTimeline", "å·²åŠ å…¥é…éŸ³æ—¶é—´çº¿")}</strong><em>{t("voicePreviewHint", "è¯•å¬æœ¬æ¬¡å·²ç”Ÿæˆçš„æ—¶é—´çº¿é…éŸ³")}</em></span></div>
          <audio controls preload="metadata" src={audioUrl} />
        </div>
      ) : null}
    </>
  );
}

export function MyVoicesPanel({
  notify,
  t,
  selectedVoice,
  voiceProfiles,
  addVoiceProfile,
  removeVoiceProfile,
  selectedVoiceProfileId,
  setSelectedVoiceProfileId,
  toggleVoiceProfileFavorite,
  recordedVoices,
  recordingState,
  recordingElapsed,
  startVoiceRecording,
  stopVoiceRecording,
  downloadBlob,
}) {
  const isRecording = recordingState === "recording";
  const isProcessingRecording = recordingState === "processing";
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [cloneState, setCloneState] = useState("idle");
  const [cloneProgress, setCloneProgress] = useState(0);
  const [clonePhase, setClonePhase] = useState("");
  const [testBlob, setTestBlob] = useState(null);
  const [embedding, setEmbedding] = useState(null);
  const latestRecordingIdRef = useRef(recordedVoices[0]?.id || "");
  const testUrl = useMemo(() => testBlob ? URL.createObjectURL(testBlob) : "", [testBlob]);
  const referenceUrl = useMemo(() => draft?.blob ? URL.createObjectURL(draft.blob) : "", [draft]);

  useEffect(() => () => { if (testUrl) URL.revokeObjectURL(testUrl); }, [testUrl]);
  useEffect(() => () => { if (referenceUrl) URL.revokeObjectURL(referenceUrl); }, [referenceUrl]);

  const chooseReference = (blob, name, sourceKind) => {
    setDraft({ blob, name, sourceKind }); setAuthorized(false); setTestBlob(null); setEmbedding(null); setCloneState("idle");
  };
  useEffect(() => {
    const latest = recordedVoices[0];
    if (!latest || latest.id === latestRecordingIdRef.current) return;
    latestRecordingIdRef.current = latest.id;
    chooseReference(latest.blob, latest.name, "recording");
  }, [recordedVoices]);
  const runCloneTest = async () => {
    if (!draft?.blob || !authorized || cloneState === "running") return;
    setCloneState("running"); setCloneProgress(3); setClonePhase(t("cloneChecking", "æ£€æŸ¥å‚è€ƒå£°éŸ³"));
    try {
      const nextEmbedding = await extractVoiceEmbedding(draft.blob, (event) => {
        setCloneProgress(Math.min(48, Math.round((event.progress || 0) * 0.55))); setClonePhase(event.phase || t("cloneEncoding", "æå–éŸ³è‰²"));
      });
      const { blob: baseBlob } = await synthesizeBaseVoice({
        voice: selectedVoice, text: getVoiceCloneTestSentence(selectedVoice), speed: 1, notify, t,
        onStatus: (statusKey) => setClonePhase(t(statusKey)),
        onProgress: (progress) => setCloneProgress(48 + Math.round(Math.min(100, progress) * 0.18)),
      });
      const converted = await convertVoiceBlob(baseBlob, nextEmbedding, {
        onProgress: (event) => { setCloneProgress(66 + Math.round((event.progress || 0) * 0.34)); setClonePhase(event.phase || t("cloneConverting", "ç”Ÿæˆå…‹éš†è¯•å¬")); },
      });
      setEmbedding(nextEmbedding); setTestBlob(converted); setCloneProgress(100); setCloneState("ready");
    } catch (error) {
      console.error(error); setCloneState("error"); setClonePhase(error instanceof Error ? error.message : t("cloneFailed", "å…‹éš†è¯•å¬å¤±è´¥"));
    }
  };
  const saveClone = async () => {
    if (!draft || !embedding || !testBlob || cloneState !== "ready") return;
    const now = new Date().toISOString();
    const profile = { id: crypto.randomUUID(), name: draft.name.replace(/\.[^.]+$/, "") || t("myCloneVoice", "æˆ‘çš„å…‹éš†å£°éŸ³"),
      sourceKind: draft.sourceKind, referenceBlob: draft.blob, testBlob, embedding: Float32Array.from(embedding),
      favorite: false, authorized: true, createdAt: now, updatedAt: now };
    await addVoiceProfile(profile); setSelectedVoiceProfileId(profile.id); setDraft(null); setTestBlob(null); setEmbedding(null); setAuthorized(false); setCloneState("idle");
    notify(t("cloneSaved", "å…‹éš†å£°éŸ³å·²ä¿å­˜åˆ°â€œå…‹éš†å£°éŸ³â€"));
  };

  return (
    <div className="history-panel">
      <input ref={fileInputRef} hidden type="file" accept="audio/*" onChange={(event) => {
        const file = event.target.files?.[0]; if (file) chooseReference(file, file.name, "upload"); event.target.value = "";
      }} />
      <div className="voice-source-grid">
      <div className={`record-card ${isRecording ? "is-recording" : ""}`}>
        <div>
          <strong>{t("recordReferenceVoice", "å½•åˆ¶å‚è€ƒå£°éŸ³")}</strong>
          <span>{isRecording ? `${t("recording")} Â· ${formatClock(recordingElapsed)}` : t("recordReferenceHint", "å½•åˆ¶è‡ªå·±çš„å£°éŸ³ï¼Œå®ŒæˆåŽç›´æŽ¥è¿›å…¥å…‹éš†è¯•å¬ã€‚")}</span>
        </div>
        <button
          type="button"
          disabled={isProcessingRecording}
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
        >
          {isRecording ? <Pause size={15} weight="fill" /> : <MicrophoneStage size={15} weight="fill" />}
          {isRecording ? t("stopRecording") : isProcessingRecording ? t("generating") : t("startRecording")}
        </button>
      </div>

      <button className="record-card upload-voice-card" type="button" onClick={() => fileInputRef.current?.click()}>
        <div><strong>{t("uploadVoice", "ä¸Šä¼ å£°éŸ³")}</strong><span>{t("uploadVoiceHint", "é€‰æ‹©æ¸…æ™°çš„å•äººè¯­éŸ³ä½œä¸ºå‚è€ƒ")}</span></div>
        <CloudArrowUp size={22} weight="bold" />
      </button>
      </div>

      {draft ? (
        <section className="clone-enrollment-card">
          <header><div><strong>{t("cloneTestTitle", "å…‹éš†è¯•å¬")}</strong><span>{draft.name}</span></div><button type="button" onClick={() => setDraft(null)}><X size={15} /></button></header>
          <div className="clone-test-language"><span>{t("cloneTestLanguage", "æµ‹è¯•è¯­è¨€")}</span><strong>{selectedVoice.language}</strong><em>{getVoiceCloneTestSentence(selectedVoice)}</em></div>
          <audio controls preload="metadata" src={referenceUrl} />
          <label className="clone-consent"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /><span>{t("cloneConsent", "æˆ‘ç¡®è®¤å·²èŽ·å¾—è¯¥å£°éŸ³çš„æŽˆæƒï¼Œå¹¶ä»…ç”¨äºŽåˆæ³•ã€éžè¯¯å¯¼ç”¨é€”ã€‚")}</span></label>
          {cloneState === "running" ? <div className="voice-generation-loading clone-generation-loading" role="status" aria-live="polite"><i className="voice-generation-spinner" aria-hidden="true" /><div><strong>{clonePhase}</strong><span>{t("cloneLocalHint", "å£°éŸ³åªåœ¨å½“å‰æµè§ˆå™¨ä¸­å¤„ç†")}</span></div><em>{cloneProgress}%</em><div className="progress-track"><span style={{ width: `${cloneProgress}%` }} /></div></div> : null}
          {cloneState === "error" ? <div className="clone-inline-error">{clonePhase}</div> : null}
          {testUrl ? <div className="clone-ab-preview"><span>{t("cloneListenBeforeSave", "è¯·å…ˆè¯•å¬å…‹éš†ç»“æžœï¼Œç¡®è®¤æ»¡æ„åŽå†ä¿å­˜")}</span><audio controls preload="metadata" src={testUrl} /></div> : null}
          <div className="clone-actions"><button type="button" disabled={!authorized || cloneState === "running"} onClick={runCloneTest}>{testBlob ? t("cloneRetest", "é‡æ–°æµ‹è¯•") : t("cloneTest", "æµ‹è¯•å…‹éš†")}</button><button type="button" className="is-primary" disabled={!testBlob || cloneState !== "ready"} onClick={saveClone}>{t("saveToMyVoices", "ä¿å­˜åˆ°æˆ‘çš„å£°éŸ³")}</button></div>
        </section>
      ) : null}

      {recordedVoices.length ? (
        <>
          <div className="panel-subtitle">{t("recordedVoices")}</div>
          {recordedVoices.map((recording) => (
            <div className="history-item is-recording-item" key={recording.id}>
              <div>
                <strong>{recording.name}</strong>
                <span>
                  {recording.createdAt} Â· {formatTime(recording.duration)}
                </span>
              </div>
              <button type="button" onClick={() => chooseReference(recording.blob, recording.name, "recording")}>
                {t("useAsReference", "ä½œä¸ºå‚è€ƒ")}
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(recording.blob, `${recording.name}.${recording.extension}`)}
              >
                {t("download")}
              </button>
            </div>
          ))}
        </>
      ) : null}

      <div className="panel-subtitle">{t("savedCloneVoices", "å·²ä¿å­˜çš„å…‹éš†å£°éŸ³")}</div>
      {voiceProfiles.length ? voiceProfiles.map((profile) => (
          <div className={`history-item clone-profile-item ${selectedVoiceProfileId === profile.id ? "is-selected" : ""}`} key={profile.id}>
            <div className="clone-profile-copy">
              <strong>{profile.name}</strong><span>{profile.sourceKind === "recording" ? t("recordVoice", "å½•åˆ¶å£°éŸ³") : t("uploadVoice", "ä¸Šä¼ å£°éŸ³")}</span>
            </div>
            <div className="clone-profile-actions">
              <button type="button" onClick={() => { setSelectedVoiceProfileId(profile.id); notify(t("cloneSelected", "å·²é€‰æ‹©å…‹éš†éŸ³è‰²")); }}>{t("use")}</button>
              <button type="button" onClick={() => toggleVoiceProfileFavorite(profile.id)}>{profile.favorite ? t("saved") : t("favorite")}</button>
              <button type="button" onClick={() => removeVoiceProfile(profile.id)}>{t("delete")}</button>
            </div>
          </div>
        )) : <div className="empty-state">{t("noCloneVoices", "ä¸Šä¼ æˆ–å½•åˆ¶å‚è€ƒå£°éŸ³ï¼Œé€šè¿‡è¯•å¬åŽä¼šæ˜¾ç¤ºåœ¨è¿™é‡Œã€‚")}</div>}
    </div>
  );
}

export function FavoriteVoicesPanel({ favoriteVoiceIds, setFavoriteVoiceIds, selectedVoiceId, setSelectedVoiceId,
  voiceProfiles, selectedVoiceProfileId, setSelectedVoiceProfileId, toggleVoiceProfileFavorite, notify, t }) {
  const builtIns = VOICES.filter((voice) => favoriteVoiceIds.includes(voice.id));
  const clones = voiceProfiles.filter((profile) => profile.favorite);
  return <div className="history-panel">
    <div className="panel-subtitle">{t("builtInVoices", "å†…ç½®å£°éŸ³")}</div>
    {builtIns.map((voice) => <div className={`history-item ${selectedVoiceId === voice.id && !selectedVoiceProfileId ? "is-selected" : ""}`} key={voice.id}><div><strong>{voice.name}</strong><span>{voice.language} Â· {voice.detail}</span></div><button type="button" onClick={() => { setSelectedVoiceId(voice.id); setSelectedVoiceProfileId(""); notify(t("voiceSelected", "å·²åˆ‡æ¢å£°éŸ³")); }}>{t("use")}</button><button type="button" onClick={() => setFavoriteVoiceIds((ids) => ids.filter((id) => id !== voice.id))}>{t("remove")}</button></div>)}
    <div className="panel-subtitle">{t("cloneVoices", "å…‹éš†å£°éŸ³")}</div>
    {clones.map((profile) => <div className={`history-item ${selectedVoiceProfileId === profile.id ? "is-selected" : ""}`} key={profile.id}><div><strong>{profile.name}</strong><span>{t("browserLocalVoice", "ä¿å­˜åœ¨å½“å‰æµè§ˆå™¨")}</span></div><button type="button" onClick={() => setSelectedVoiceProfileId(profile.id)}>{t("use")}</button><button type="button" onClick={() => toggleVoiceProfileFavorite(profile.id)}>{t("remove")}</button></div>)}
    {!builtIns.length && !clones.length ? <div className="empty-state">{t("noFavoriteVoices")}</div> : null}
  </div>;
}

export function HistoryPanel({ historyItems, useHistoryItem: onUseHistoryItem, setHistoryItems, downloadBlob, t }) {
  return (
    <div className="history-panel">
      {historyItems.length ? (
        historyItems.map((item) => (
          <div className="history-item" key={item.id}>
            <div>
              <strong>{item.voiceName}</strong>
              <span>
                {item.createdAt} Â· {formatTime(item.duration)} Â· {item.script.slice(0, 18)}
              </span>
            </div>
            <button type="button" onClick={() => onUseHistoryItem(item)}>
              {t("use")}
            </button>
            <button type="button" onClick={() => downloadBlob(item.blob, `history-${item.voiceName}.wav`)}>
              {t("download")}
            </button>
            <button type="button" onClick={() => setHistoryItems((items) => items.filter((entry) => entry.id !== item.id))}>
              {t("delete")}
            </button>
          </div>
        ))
      ) : (
        <div className="empty-state">{t("noMediaHistory")}</div>
      )}
    </div>
  );
}
