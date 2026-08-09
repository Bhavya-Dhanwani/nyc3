import { useEffect, useState } from "react";

export function isValidPreviewShellMeasurement(shell) {
  return Boolean(shell?.isConnected && shell.clientWidth >= 2 && shell.clientHeight >= 2);
}

export function usePreviewFrameSize(shellRef, ratio, compactRail) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let observer = null;
    let rafId = null;
    let attempts = 0;

    const measure = (el) => {
      const target = el || shellRef?.current;
      if (!target || !isValidPreviewShellMeasurement(target)) return false;
      const style = getComputedStyle(target);
      const aw = Math.max(1, target.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0));
      const ah = Math.max(1, target.clientHeight - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0));
      const ratioW = Number(ratio?.width) || 16;
      const ratioH = Number(ratio?.height) || 9;
      const width = Math.max(1, Math.floor(Math.min(aw, (ah * ratioW) / ratioH)));
      const height = Math.max(1, Math.floor((width * ratioH) / ratioW));
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
      return true;
    };

    const attach = () => {
      const shell = shellRef?.current;
      if (shell && isValidPreviewShellMeasurement(shell)) {
        measure(shell);
        if (window.ResizeObserver && !observer) {
          observer = new ResizeObserver(() => {
            measure();
          });
          observer.observe(shell);
        }
      } else if (attempts < 60) {
        attempts += 1;
        rafId = requestAnimationFrame(attach);
      }
    };

    attach();

    const handleResize = () => {
      measure();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [compactRail, ratio?.height, ratio?.width, shellRef]);

  return size;
}
