import { useCallback } from "react";
import { transcribeAudioToCaptionSegments } from "../lib/asr.js";
import { sliceAudioBlob, extractAudioFromVideo } from "../lib/media.js";
import { makeId } from "../lib/timeline.js";
import api from "../lib/api.js";

export function localizeAutoCaptionPhase(phase, t) {
  const text = String(phase || "");
  const format = (key, fallback, values = {}) =>
    Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), t(key, fallback));
  if (text.includes("下载或读取") && text.includes("Whisper")) return t("asrDownloadingModel", text);
  if (text.includes("识别音频语言")) return t("asrDetectingLanguage", text);
  if (text.includes("初始化 WebGPU")) return t("asrInitializingWebGpu", text);
  if (text.includes("初始化 WASM")) return t("asrInitializingWasm", text);
  if (text.includes("WebGPU 初始化失败")) return t("asrFallingBackWasm", text);
  if (text.includes("解码原声音频")) return t("asrDecodingAudio", text);
  if (text.includes("Worker 不可用")) return t("asrWorkerFallback", text);
  if (text.includes("Worker 结果异常")) return t("asrRetryingWasm", text);
  if (text.includes("写入字幕轨道")) return t("asrWritingCaptions", text);
  const languageMatch = text.match(/(?:检测为|按)\s+(.+?)\s+转写字幕/);
  if (languageMatch) return format("asrTranscribingLanguage", text, { language: languageMatch[1] });
  return text;
}

// Convert word timestamps into standard 3-5 word subtitle segments
function wordsToCaptionSegments(words = [], wordsPerChunk = 4) {
  const segments = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk);
    if (!chunk.length) continue;
    const text = chunk.map((w) => w.text || w.word || "").join(" ").trim();
    const start = Number(chunk[0].start ?? 0);
    const end = Number(chunk[chunk.length - 1].end ?? start + 1.5);
    if (text) {
      segments.push({
        id: makeId("caption"),
        text,
        start,
        end: Math.max(start + 0.3, end),
        hidden: false,
        captionData: { words: chunk },
      });
    }
  }
  return segments;
}

export function useAutoCaptions(d) {
  return useCallback(
    async (options = {}) => {
      if (d.status === "generating" || d.status === "captioning") return;
      if (d.trackLocks?.caption) return void d.notify(d.t("captionTrackLocked", "Caption track is locked"));

      d.setStatus("captioning");
      d.setStatusText(d.t("autoCaptionsPreparing", "Preparing captions from main video audio..."));
      d.setProgress(5);
      d.setActiveTool("caption");

      const timelineOffset = Number.isFinite(options.start) ? options.start : d.sourceAudioStart || 0;

      try {
        // 1. Check if the project already has an existing transcript in memory or backend
        const projectId = d.currentProject?._id || d.currentProject?.id || d.projectId;
        let existingWords = null;

        if (d.currentProject?.transcript) {
          if (Array.isArray(d.currentProject.transcript.words)) {
            existingWords = d.currentProject.transcript.words;
          } else if (d.currentProject.transcript.rawJson) {
            try {
              const parsed = JSON.parse(d.currentProject.transcript.rawJson);
              existingWords = parsed.words || null;
            } catch {}
          }
        }

        // If not in memory, try fetching from backend project detail
        if (!existingWords && projectId) {
          try {
            const res = await api.get(`/api/projects/${projectId}`);
            const projectData = res.data?.data;
            if (projectData?.transcript) {
              const parsed = typeof projectData.transcript.rawJson === "string"
                ? JSON.parse(projectData.transcript.rawJson)
                : projectData.transcript;
              if (parsed?.words?.length) {
                existingWords = parsed.words;
              }
            }
          } catch {}
        }

        // If existing transcript is found, convert to caption segments immediately!
        if (existingWords && existingWords.length > 0) {
          d.setStatusText("Generating aligned subtitle segments...");
          d.setProgress(80);

          const generatedSegments = wordsToCaptionSegments(existingWords);
          if (generatedSegments.length > 0) {
            d.setCaptionSegments(generatedSegments);
            d.setCaptionsEnabled(true);
            d.setTrackVisibility?.((visibility) => ({ ...visibility, caption: true }));
            d.setSelectedSegmentId(generatedSegments[0].id);
            d.setSelectedTrack("caption");
            d.setStatus("done");
            d.setStatusText(`Generated ${generatedSegments.length} captions from main video`);
            d.setProgress(100);
            d.seekTo(generatedSegments[0].start || 0);
            d.notify?.(`Generated ${generatedSegments.length} synchronized captions from main video!`);
            return;
          }
        }

        // 2. Resolve audio input blob from 1st layer main video
        let inputBlob = options.blob ?? d.sourceAudioBlob;

        // If no source audio blob, extract directly from 1st layer video segment
        if (!inputBlob) {
          const mainVideoSegment = d.visualSegments?.[0];
          const videoSrc = mainVideoSegment?.src || d.imageSrc || d.currentProject?.sourcePath;

          if (mainVideoSegment?.blob instanceof Blob) {
            d.setStatusText("Extracting audio from 1st layer video...");
            d.setProgress(15);
            inputBlob = await extractAudioFromVideo(mainVideoSegment.blob, "main-video.mp4");
          } else if (videoSrc && typeof videoSrc === "string") {
            d.setStatusText("Loading main video audio stream...");
            d.setProgress(15);
            try {
              const resp = await fetch(videoSrc);
              const videoBlob = await resp.blob();
              inputBlob = await extractAudioFromVideo(videoBlob, "main-video.mp4");
            } catch (fetchErr) {
              console.warn("Could not fetch video source directly for extraction:", fetchErr);
            }
          }
        }

        if (!inputBlob) {
          d.setStatus("ready");
          d.setProgress(0);
          d.notify(d.t("autoCaptionsNeedsSource", "Please add a video or audio to the timeline first"));
          return;
        }

        // 3. Transcribe audio into word-level caption segments using ASR Whisper / WebGPU / WASM
        d.setStatusText("Transcribing speech from main video...");
        d.setProgress(30);

        const clipBlob = Number.isFinite(options.duration)
          ? await sliceAudioBlob(inputBlob, options.sourceStart || 0, options.duration)
          : inputBlob;

        const result = await transcribeAudioToCaptionSegments(clipBlob, {
          preferredLanguage: d.uiLanguage || "en",
          timelineOffset,
          onProgress: ({ progress, phase }) => {
            d.setProgress((current) => Math.max(current, progress));
            d.setStatusText(localizeAutoCaptionPhase(phase, d.t));
          },
        });

        d.setCaptionSegments((segments) => {
          const combined = (options.append ? [...segments, ...result.segments] : result.segments).sort(
            (a, b) => (a.start || 0) - (b.start || 0)
          );
          let inheritedFontId = d.captionStyle?.fontId || "default";
          return combined.map((segment) => {
            inheritedFontId = segment.fontId || inheritedFontId;
            return segment.fontId ? segment : { ...segment, fontId: inheritedFontId };
          });
        });

        d.setScript?.((script) => (options.append && script ? `${script}\n${result.text}` : result.text));
        d.setSelectedSegmentId(result.segments[0]?.id ?? "");
        d.setSelectedTrack("caption");
        d.setActiveTool("caption");
        d.setCaptionsEnabled(true);
        d.setTrackVisibility?.((visibility) => ({ ...visibility, caption: true }));

        const completeMsg = `Generated ${result.segments.length} captions from main video!`;
        d.setStatus("done");
        d.setStatusText(completeMsg);
        d.setProgress(100);
        d.seekTo(result.segments[0]?.start ?? timelineOffset);
        d.notify(completeMsg);
      } catch (error) {
        console.error("Auto-caption error:", error);
        d.setStatus("error");
        d.setStatusText(error instanceof Error ? error.message : "Failed to generate captions");
        d.setProgress(0);
        d.notify("Failed to generate captions from main video");
      }
    },
    [d]
  );
}
