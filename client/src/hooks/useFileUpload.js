import { useCallback } from "react";
import { MAX_TIMELINE_DURATION_SECONDS, SUPPORTED_MEDIA_TYPES } from "../config/editor.js";
import { decodeWaveform, extractVideoThumbnail, extractVideoTrackFrames, normalizeVideoForEditing } from "../lib/media.js";
import { getMediaFileKind, isSupportedMediaFile, MEDIA_BACKENDS, probeMediaCompatibility, selectMediaBackends, shouldProbeWithLibav } from "../lib/mediaCompatibility.js";
import { formatClock, formatTime } from "../lib/timeline.js";

export function shouldAutoAddImportedVisual(assets, visualSegments) {
  return Boolean(
    !visualSegments.length && assets.some((asset) => asset.type === "image" || asset.type === "video"),
  );
}

export function useFileUpload(deps) {
  return useCallback((files) => {
    const mediaFiles = Array.from(files ?? []).filter((file) =>
      SUPPORTED_MEDIA_TYPES.some((type) => file.type.startsWith(type)) || isSupportedMediaFile(file));
    if (!mediaFiles.length) return void deps.notify("请选择图片、视频或音频素材");
    const assets = mediaFiles.map((file) => {
      const src = URL.createObjectURL(file); deps.imageUrlRefs.current.add(src);
      const type = getMediaFileKind(file);
      return { id: crypto.randomUUID(), type, src, name: file.name, meta: "读取中", blob: file,
        duration: type === "video" ? 0 : 4, width: 0, height: 0, trackFrames: [] };
    });
    const primary = assets[0]; deps.setSelectedLibraryAssetId(primary.id); deps.setUserAssets((current) => [...assets, ...current]);
    const primaryVisual = assets.find((asset) => asset.type === "image" || asset.type === "video");
    const shouldAutoAddFirstVisual = shouldAutoAddImportedVisual(assets, deps.visualSegments);
    if (primaryVisual && shouldAutoAddFirstVisual) {
      deps.appendVisualAssetToTimeline(primaryVisual);
    }
    const update = (id, patch) => deps.setUserAssets((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    assets.forEach(async (asset) => {
      if (asset.type === "audio") {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
          const duration = Math.min(MAX_TIMELINE_DURATION_SECONDS, Math.max(0.5, audio.duration || 1));
          update(asset.id, { meta: formatClock(duration), duration });
          decodeWaveform(asset.blob).then((peaks) => update(asset.id, { peaks })).catch(() => {});
        };
        audio.onerror = () => update(asset.id, { meta: "读取失败" }); audio.src = asset.src; return;
      }
      if (asset.type === "video") {
        const prepareCompatibleVideo = async () => {
          update(asset.id, { meta: deps.t("mediaCompatibilityPreparing") });
          try {
            let probe = null;
            try {
              probe = await probeMediaCompatibility(asset.blob, { nativeMetadataError: true, decodeAudio: true });
            } catch (error) {
              console.warn("Media probe failed", error);
            }
            const videoStream = probe?.streams?.find((stream) => stream.type === "video");
            const audioStream = probe?.streams?.find((stream) => stream.type === "audio");
            const compatibilityAudioBlob = probe?.decodedAudio?.blob ?? null;
            const backends = probe ? selectMediaBackends({
              nativeReadable: false, container: probe?.container, videoCodec: videoStream?.codec, audioCodec: audioStream?.codec,
              webCodecsVideoSupported: typeof VideoDecoder !== "undefined" && ["h264", "vp8", "vp9", "av1"].includes(videoStream?.codec),
              webCodecsAudioSupported: typeof AudioDecoder !== "undefined" && ["aac", "opus", "mp3", "flac"].includes(audioStream?.codec),
              libavAudioSupported: Boolean(compatibilityAudioBlob),
            }) : { probe: MEDIA_BACKENDS.LIBAV, video: MEDIA_BACKENDS.WEBCODECS, audio: MEDIA_BACKENDS.WEBCODECS, needsNormalization: true };
            const normalizedBlob = await normalizeVideoForEditing(asset.blob, asset.name, { decodedAudioBlob: compatibilityAudioBlob });
            const normalizedSrc = URL.createObjectURL(normalizedBlob); deps.imageUrlRefs.current.add(normalizedSrc);
            applyVideoMetadata({ ...asset, src: normalizedSrc, blob: normalizedBlob, compatibilityAudioBlob }, { probe, backends, originalName: asset.name });
            deps.notify(deps.t("mediaCompatibilityReady"));
          } catch (error) {
            console.error("Media compatibility fallback failed", error);
            update(asset.id, { meta: deps.t("mediaCompatibilityFailed") });
            deps.notify(deps.t("mediaCompatibilityFailedHint"));
          }
        };
        const applyVideoMetadata = (sourceAsset, compatibility = null) => {
          if (!compatibility && shouldProbeWithLibav(sourceAsset.blob)) {
            void prepareCompatibleVideo();
            return;
          }
          const video = document.createElement("video"); video.preload = "metadata";
          video.onloadedmetadata = async () => {
            const duration = Math.min(MAX_TIMELINE_DURATION_SECONDS, Math.max(0.5, video.duration || 1));
            const width = video.videoWidth || 0; const height = video.videoHeight || 0;
            const backendLabel = compatibility?.backends?.probe ? ` · ${compatibility.backends.probe}` : "";
            const initialThumb = await extractVideoThumbnail(sourceAsset.src, { width, height });
            const patch = { meta: `${width || "?"} x ${height || "?"} · ${formatClock(duration)}${backendLabel}`,
              duration, width, height, type: "video", src: sourceAsset.src, blob: sourceAsset.blob,
              thumbnail: initialThumb || "",
              trackFrames: initialThumb ? [initialThumb] : [],
              trackFrameDuration: duration,
              compatibilityAudioBlob: sourceAsset.compatibilityAudioBlob ?? null, mediaCompatibility: compatibility };
            update(asset.id, patch); deps.updateVisualAssetInTimeline(asset.id, patch);
            extractVideoTrackFrames(sourceAsset.src, {
              duration,
              width,
              height,
              onBatch: (trackFrames) => {
                if (!trackFrames.length) return;
                update(asset.id, { trackFrames });
                deps.updateVisualAssetInTimeline(asset.id, { trackFrames });
              },
            }).then((trackFrames) => {
              if (!trackFrames.length) return;
              update(asset.id, { trackFrames }); deps.updateVisualAssetInTimeline(asset.id, { trackFrames });
            }).catch((error) => console.warn("Video timeline frame extraction failed", error));
          };
          video.onerror = async () => {
            if (compatibility || !shouldProbeWithLibav(asset.blob, { nativeMetadataError: true })) {
              update(asset.id, { meta: deps.t("mediaCompatibilityFailed") });
              return;
            }
            await prepareCompatibleVideo();
          };
          video.src = sourceAsset.src;
        };
        applyVideoMetadata(asset); return;
      }
      const image = new Image();
      image.onload = () => {
        const patch = { meta: `${image.naturalWidth || 0} x ${image.naturalHeight || 0}`, width: image.naturalWidth || 0, height: image.naturalHeight || 0, type: "image" };
        update(asset.id, patch); deps.updateVisualAssetInTimeline(asset.id, patch);
      };
      image.onerror = () => update(asset.id, { meta: "读取失败" }); image.src = asset.src;
    });
    deps.notify(mediaFiles.length > 1 ? `已上传 ${mediaFiles.length} 个素材${shouldAutoAddFirstVisual ? "，项目首个画面已加入时间线" : "，请拖到目标轨道使用"}`
      : primaryVisual ? shouldAutoAddFirstVisual
        ? `${primary.type === "video" ? "视频" : "图片"}已加入画布和时间线`
        : `${primary.type === "video" ? "视频" : "图片"}已加入素材库，请拖到 Visuals 或画中画轨道`
      : "音频已上传到素材库，可拖到音乐或配音轨");
  }, [deps]);
}
