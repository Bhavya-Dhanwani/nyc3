import { useState, useCallback, useRef, useEffect } from "react";
import { useDefaultLayout, useGroupRef, usePanelRef } from "react-resizable-panels";

const STORAGE_KEY = "katetor-editor-layout";

export const DEFAULT_LAYOUTS = {
  vertical: {
    "main-workspace-panel": 68,
    "bottom-timeline-panel": 32
  },
  horizontal: {
    "left-tools-panel": 22,
    "center-preview-panel": 52,
    "right-inspector-panel": 26
  }
};

const customLayoutStorage = {
  getItem: (name) => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return all[name] ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      all[name] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }
};

export function useEditorLayout() {
  const verticalGroupRef = useGroupRef();
  const horizontalGroupRef = useGroupRef();

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const timelinePanelRef = usePanelRef();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Boolean(all["left-collapsed"]);
    } catch {
      return false;
    }
  });

  const [isRightCollapsed, setIsRightCollapsed] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Boolean(all["right-collapsed"]);
    } catch {
      return false;
    }
  });

  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Boolean(all["timeline-collapsed"]);
    } catch {
      return false;
    }
  });

  // Vertical group layout hook
  const {
    defaultLayout: verticalDefaultLayout,
    onLayoutChanged: onVerticalLayoutChanged
  } = useDefaultLayout({
    id: "v",
    storage: customLayoutStorage
  });

  // Horizontal group layout hook
  const {
    defaultLayout: horizontalDefaultLayout,
    onLayoutChanged: onHorizontalLayoutChanged
  } = useDefaultLayout({
    id: "h",
    storage: customLayoutStorage
  });

  const toggleLeftCollapse = useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsLeftCollapsed(false);
      customLayoutStorage.setItem("left-collapsed", false);
    } else {
      panel.collapse();
      setIsLeftCollapsed(true);
      customLayoutStorage.setItem("left-collapsed", true);
    }
  }, [leftPanelRef]);

  const toggleRightCollapse = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsRightCollapsed(false);
      customLayoutStorage.setItem("right-collapsed", false);
    } else {
      panel.collapse();
      setIsRightCollapsed(true);
      customLayoutStorage.setItem("right-collapsed", true);
    }
  }, [rightPanelRef]);

  const toggleTimelineCollapse = useCallback(() => {
    const panel = timelinePanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsTimelineCollapsed(false);
      customLayoutStorage.setItem("timeline-collapsed", false);
    } else {
      panel.collapse();
      setIsTimelineCollapsed(true);
      customLayoutStorage.setItem("timeline-collapsed", true);
    }
  }, [timelinePanelRef]);

  const resetLayout = useCallback(() => {
    try {
      // Clear storage
      localStorage.removeItem(STORAGE_KEY);

      // Expand all panels
      if (leftPanelRef.current?.isCollapsed()) leftPanelRef.current.expand();
      if (rightPanelRef.current?.isCollapsed()) rightPanelRef.current.expand();
      if (timelinePanelRef.current?.isCollapsed()) timelinePanelRef.current.expand();

      setIsLeftCollapsed(false);
      setIsRightCollapsed(false);
      setIsTimelineCollapsed(false);

      // Apply default percentage sizes
      verticalGroupRef.current?.setLayout(DEFAULT_LAYOUTS.vertical);
      horizontalGroupRef.current?.setLayout(DEFAULT_LAYOUTS.horizontal);
    } catch (e) {
      console.warn("Error resetting editor layout", e);
    }
  }, [leftPanelRef, rightPanelRef, timelinePanelRef, verticalGroupRef, horizontalGroupRef]);

  return {
    verticalGroupRef,
    horizontalGroupRef,
    leftPanelRef,
    rightPanelRef,
    timelinePanelRef,
    isLeftCollapsed,
    isRightCollapsed,
    isTimelineCollapsed,
    setIsLeftCollapsed,
    setIsRightCollapsed,
    setIsTimelineCollapsed,
    toggleLeftCollapse,
    toggleRightCollapse,
    toggleTimelineCollapse,
    resetLayout,
    verticalDefaultLayout: verticalDefaultLayout || DEFAULT_LAYOUTS.vertical,
    horizontalDefaultLayout: horizontalDefaultLayout || DEFAULT_LAYOUTS.horizontal,
    onVerticalLayoutChanged,
    onHorizontalLayoutChanged,
  };
}
