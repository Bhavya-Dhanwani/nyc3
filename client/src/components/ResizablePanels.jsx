import React from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  usePanelRef,
  useDefaultLayout
} from "react-resizable-panels";
import {
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  ArrowsIn,
  ArrowsOut,
  ArrowCounterClockwise
} from "@phosphor-icons/react";

export { Group as PanelGroup, Panel, Separator as PanelResizeHandle, useGroupRef, usePanelRef, useDefaultLayout };

export function EditorResizeSeparator({ orientation = "vertical", className = "", ...props }) {
  return (
    <Separator
      className={`editor-resize-separator ${orientation === "vertical" ? "is-vertical" : "is-horizontal"} ${className}`}
      {...props}
    >
      <div className="resize-separator-grip" />
    </Separator>
  );
}

export function EditorLayoutToolbar({
  onResetLayout,
  onToggleLeftCollapse,
  onToggleRightCollapse,
  onToggleTimelineCollapse,
  isLeftCollapsed = false,
  isRightCollapsed = false,
  isTimelineCollapsed = false,
  onOpenContentMap,
  contentMapActive = false,
}) {
  const isPreviewMaximized = isLeftCollapsed && isRightCollapsed && isTimelineCollapsed;

  const toggleMaximizePreview = () => {
    if (isPreviewMaximized) {
      onResetLayout?.();
    } else {
      if (!isLeftCollapsed) onToggleLeftCollapse?.();
      if (!isRightCollapsed) onToggleRightCollapse?.();
      if (!isTimelineCollapsed) onToggleTimelineCollapse?.();
    }
  };

  return (
    <div className="editor-layout-bar" role="toolbar" aria-label="Editor layout controls">
      {onOpenContentMap && (
        <button
          type="button"
          className={`layout-pill-btn ${contentMapActive ? "is-active" : ""}`}
          onClick={onOpenContentMap}
          title="Toggle Content Map Intelligence View"
        >
          <span className="pill-dot">⚡</span>
          <span>Content Map</span>
        </button>
      )}

      <button
        type="button"
        className={`layout-icon-btn ${isPreviewMaximized ? "is-active" : ""}`}
        onClick={toggleMaximizePreview}
        title={isPreviewMaximized ? "Restore Panels" : "Maximize Preview Canvas"}
      >
        {isPreviewMaximized ? <ArrowsIn size={15} /> : <ArrowsOut size={15} />}
        <span className="layout-btn-label">{isPreviewMaximized ? "Restore" : "Focus"}</span>
      </button>

      <button
        type="button"
        className="layout-icon-btn"
        onClick={onResetLayout}
        title="Reset Layout Dimensions to Default"
      >
        <ArrowCounterClockwise size={14} />
        <span className="layout-btn-label">Reset Layout</span>
      </button>
    </div>
  );
}
