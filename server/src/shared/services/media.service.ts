// Importing modules
import { exec, execFile } from "child_process";
import path from "path";
import fs from "fs";
import logger from "../config/logger.config.js";
import SmartFramingService from "./smartFraming.service.js";

// class to handle media operations using FFmpeg and FFprobe
class MediaService {

    smartFramingService: SmartFramingService;

    constructor() {
        this.smartFramingService = new SmartFramingService();
    }

    // function to check if a command exists on the host
    async commandExists(name: string): Promise<boolean> {
        return new Promise((resolve) => {
            exec(`${name} -version`, (error) => {
                resolve(!error);
            });
        });
    }

    // function to probe media file using ffprobe
    async probeMedia(filePath: string, googleToken?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let headersParam = "";
            if (googleToken && (filePath.startsWith("http://") || filePath.startsWith("https://"))) {
                headersParam = `-headers "Authorization: Bearer ${googleToken}\r\n"`;
            }

            const cmd = `ffprobe -v error -print_format json -show_format -show_streams ${headersParam} "${filePath}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`ffprobe failed for ${filePath}: ${stderr}`);
                    return reject(new Error(`ffprobe failed: ${stderr || error.message}`));
                }

                try {
                    const json = JSON.parse(stdout);
                    const streams = json.streams || [];
                    const videoStream = streams.find((s: any) => s.codec_type === "video");
                    const audioStream = streams.find((s: any) => s.codec_type === "audio");
                    const durationSec = json.format && json.format.duration ? parseFloat(json.format.duration) : null;

                    const result = {
                        durationSec,
                        hasVideo: !!videoStream,
                        width: videoStream ? parseInt(videoStream.width) : null,
                        height: videoStream ? parseInt(videoStream.height) : null,
                        videoCodec: videoStream ? videoStream.codec_name : null,
                        audioCodec: audioStream ? audioStream.codec_name : null,
                        hasAudio: !!audioStream
                    };

                    resolve(result);
                } catch (parseErr: any) {
                    reject(new Error(`failed to parse ffprobe output: ${parseErr.message}`));
                }
            });
        });
    }

    async detectSilence(sourcePath: string, options: { threshold: number; minDuration: number; padding: number }): Promise<{ duration: number; silences: Array<{ start: number; end: number; duration: number }> }> {
        const probe: any = await this.probeMedia(sourcePath);
        const duration = Number(probe.durationSec);
        if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not determine media duration");
        if (!probe.hasAudio) { const error: any = new Error("This video does not contain an audio track."); error.code = "NO_AUDIO"; throw error; }
        const threshold = Math.max(-60, Math.min(-10, Number(options.threshold)));
        const minDuration = Math.max(0.1, Math.min(10, Number(options.minDuration)));
        const padding = Math.max(0, Math.min(1, Number(options.padding)));
        const args = ["-hide_banner", "-nostdin", "-i", sourcePath, "-map", "0:a:0", "-af", `silencedetect=noise=${threshold}dB:d=${minDuration}`, "-f", "null", "-"];
        const stderr = await new Promise<string>((resolve, reject) => execFile("ffmpeg", args, { timeout: 120000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, _stdout, output) => { if (error && !/silence_(start|end)/.test(output || "")) return reject(error); resolve(output || ""); }));
        const raw: Array<{ start: number; end: number }> = []; let pendingStart: number | null = null;
        for (const line of stderr.split(/\r?\n/)) { const startMatch = line.match(/silence_start\s*:\s*(-?\d+(?:\.\d+)?)/i); if (startMatch) pendingStart = Number(startMatch[1]); const endMatch = line.match(/silence_end\s*:\s*(-?\d+(?:\.\d+)?)/i); if (endMatch && pendingStart !== null) { raw.push({ start: pendingStart, end: Number(endMatch[1]) }); pendingStart = null; } }
        if (pendingStart !== null) raw.push({ start: pendingStart, end: duration });
        const ranges = raw.map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(duration, end) })).filter((range) => range.end - range.start >= minDuration - 0.001).sort((a, b) => a.start - b.start).reduce<Array<{ start: number; end: number }>>((ranges, range) => { const previous = ranges.at(-1); if (previous && range.start <= previous.end + 0.001) previous.end = Math.max(previous.end, range.end); else ranges.push(range); return ranges; }, []).map(({ start, end }) => ({ start: Math.min(end, start + padding), end: Math.max(start, end - padding) })).filter((range) => range.end - range.start > 0.001);
        return { duration, silences: ranges.map((range) => ({ ...range, duration: range.end - range.start })) };
    }
    // function to extract audio mp3 file from media (compact and optimized for Whisper cloud limits)
    async extractAudio(sourcePath: string, projectDir: string, googleToken?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.mkdirSync(projectDir, { recursive: true });
            const outputPath = path.join(projectDir, "transcription_audio.mp3");

            let headersParam = "";
            if (googleToken && (sourcePath.startsWith("http://") || sourcePath.startsWith("https://"))) {
                headersParam = `-headers "Authorization: Bearer ${googleToken}\r\n"`;
            }

            // 48kbps mono 16kHz MP3 provides optimal speech recognition quality while being ~10x smaller than WAV
            const cmd = `ffmpeg -y ${headersParam} -i "${sourcePath}" -vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 48k "${outputPath}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`ffmpeg audio extraction failed: ${stderr}`);
                    return reject(new Error(`ffmpeg audio extraction failed: ${stderr || error.message}`));
                }
                resolve(outputPath);
            });
        });
    }

    // function to pre-cut a video segment with high performance faststart settings
    async extractVideoSegment(
        sourcePath: string,
        startSec: number,
        endSec: number,
        outputPath: string,
        googleToken?: string
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const start = startSec.toFixed(3);
            const end = endSec.toFixed(3);

            let headersParam = "";
            if (googleToken && (sourcePath.startsWith("http://") || sourcePath.startsWith("https://"))) {
                headersParam = `-headers "Authorization: Bearer ${googleToken}\r\n"`;
            }

            // High performance faststart without filtering for Remotion input
            const cmd = `ffmpeg -y ${headersParam} -ss ${start} -to ${end} -i "${sourcePath}" -c:v libx264 -preset superfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags faststart "${outputPath}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`ffmpeg extractVideoSegment failed: ${stderr}`);
                    return reject(new Error(`ffmpeg extractVideoSegment failed: ${stderr || error.message}`));
                }
                resolve(outputPath);
            });
        });
    }

    // function to render short-form clip with aspect ratio & smart framing using FFmpeg
    async renderFlatClip(
        sourcePath: string,
        startSec: number,
        endSec: number,
        outputPath: string,
        drawtextFilters: string | null = null,
        aspectRatio: "vertical" | "horizontal" | "square" = "vertical",
        focusHint?: { focusX?: number; focusY?: number; zoomFactor?: number },
        googleToken?: string
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const parentDir = path.dirname(outputPath);
                fs.mkdirSync(parentDir, { recursive: true });

                const probe: any = await this.probeMedia(sourcePath, googleToken);
                const hasVideo = probe.hasVideo;
                const sourceWidth = probe.width || 1920;
                const sourceHeight = probe.height || 1080;

                const start = startSec.toFixed(3);
                const end = endSec.toFixed(3);

                let headersParam = "";
                if (googleToken && (sourcePath.startsWith("http://") || sourcePath.startsWith("https://"))) {
                    headersParam = `-headers "Authorization: Bearer ${googleToken}\r\n"`;
                }

                let cmd = `ffmpeg -y ${headersParam} -ss ${start} -to ${end} -i "${sourcePath}"`;

                if (hasVideo) {
                    let filter = "";

                    if (aspectRatio === "vertical") {
                        // Apply smart framing calculation
                        const framing = this.smartFramingService.calculateFraming(sourceWidth, sourceHeight, "vertical", focusHint);
                        filter = `${framing.ffmpegCropFilter},scale=1080:1920:flags=lanczos`;
                    } else if (aspectRatio === "square") {
                        const framing = this.smartFramingService.calculateFraming(sourceWidth, sourceHeight, "square", focusHint);
                        filter = `${framing.ffmpegCropFilter},scale=1080:1080:flags=lanczos`;
                    } else {
                        // 16:9 horizontal
                        filter = "scale=1920:1080:flags=lanczos";
                    }

                    if (drawtextFilters && drawtextFilters.trim().length > 0) {
                        filter = `${filter},${drawtextFilters}`;
                    }

                    cmd = `${cmd} -vf "${filter}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p`;
                } else {
                    cmd = `${cmd} -vn`;
                }

                cmd = `${cmd} -c:a aac -b:a 192k "${outputPath}"`;

                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(`ffmpeg clip render failed: ${stderr}`);
                        return reject(new Error(`ffmpeg clip render failed: ${stderr || error.message}`));
                    }
                    resolve(outputPath);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    // function to render short-form clip using Remotion composition engine
    async renderRemotionClip(
        sourcePath: string,
        startSec: number,
        endSec: number,
        outputPath: string,
        subwords: any[],
        stylePreset = "modern-box",
        layoutOptions: any = {}
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let tempAssPath: string | null = null;
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                logger.error(`FFmpeg render TIMEOUT for segment ${startSec}s to ${endSec}s.`);
                if (tempAssPath && fs.existsSync(tempAssPath)) {
                    try { fs.unlinkSync(tempAssPath); } catch {}
                }
                reject(new Error("FFmpeg render timed out after 30 seconds"));
            }, 30000);

            const safeResolve = (val: string) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                resolve(val);
            };

            const safeReject = (err: any) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                reject(err);
            };

            try {
                const parentDir = path.dirname(outputPath);
                fs.mkdirSync(parentDir, { recursive: true });

                const tempDir = path.resolve("./uploads/temp");
                fs.mkdirSync(tempDir, { recursive: true });

                const isVertical = layoutOptions?.aspectRatio === "vertical";
                const assContent = generateAssFileContent(subwords, startSec, endSec, stylePreset, isVertical);

                const tempAssFilename = `temp-sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.ass`;
                tempAssPath = path.join(tempDir, tempAssFilename);
                fs.writeFileSync(tempAssPath, assContent);

                logger.info(`Generated ASS subtitles at ${tempAssPath}`);

                const escapedSrtPath = escapeSubtitlePath(tempAssPath);
                
                let filterGraph = "";
                if (isVertical) {
                    filterGraph = `crop=ih*9/16:ih:(in_w-out_w)/2:0,scale=1080:1920,subtitles='${escapedSrtPath}'`;
                } else {
                    filterGraph = `scale=1920:1080,subtitles='${escapedSrtPath}'`;
                }

                const cmd = `ffmpeg -y -ss ${startSec} -to ${endSec} -i "${sourcePath}" -vf "${filterGraph}" -c:v libx264 -crf 23 -preset superfast -c:a aac -b:a 192k "${outputPath}"`;
                logger.info(`Executing FFmpeg render: ${cmd}`);

                exec(cmd, (error, stdout, stderr) => {
                    // Cleanup temp ASS file
                    try {
                        if (tempAssPath && fs.existsSync(tempAssPath)) {
                            fs.unlinkSync(tempAssPath);
                        }
                    } catch {}

                    if (error) {
                        logger.error(`FFmpeg render failed: ${stderr || error.message}`);
                        return safeReject(new Error(stderr || error.message));
                    }

                    logger.info(`FFmpeg render completed successfully. Output saved to ${outputPath}`);
                    safeResolve(outputPath);
                });
            } catch (err: any) {
                logger.error(`FFmpeg render execution error: ${err.message}`);
                safeReject(err);
            }
        });
    }

}

export default MediaService;

function hexToAssColor(hex: string, opacity = 1): string {
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
        clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    
    const alphaVal = Math.round((1 - opacity) * 255);
    const a = alphaVal.toString(16).padStart(2, "0").toUpperCase();
    
    return `&H${a}${b}${g}${r}`;
}

function generateAssFileContent(
    words: any[],
    startSec: number,
    endSec: number,
    captionStyle: any,
    isVertical = true
): string {
    let fontName = "Arial";
    let fontSize = isVertical ? 44 : 32;
    let textColor = "&H00FFFFFF"; // White
    let backColor = "&H80000000"; // Semi-transparent black
    let outlineColor = "&H00000000"; // Black outline
    let borderWidth = 2;
    let shadowWidth = 1;
    let borderStyle = 1; 

    if (typeof captionStyle === "string") {
        switch (captionStyle) {
            case "classic-outline":
                textColor = "&H0000FFFF"; // Yellow
                borderWidth = 3;
                shadowWidth = 0;
                break;
            case "minimal-shadow":
                textColor = "&H00FFFFFF";
                borderWidth = 0;
                shadowWidth = 2;
                break;
            case "vibrant-cyan":
                textColor = "&H00FFFF00"; // Cyan
                borderWidth = 0;
                shadowWidth = 2;
                break;
            case "vibrant-yellow-box":
                textColor = "&H00000000"; // Black
                backColor = "&H2000FFFF"; // Yellow box
                borderStyle = 3;
                break;
            case "vibrant-green":
                textColor = "&H0000FF00"; // Green
                borderWidth = 2;
                shadowWidth = 2;
                break;
            case "vibrant-red":
                textColor = "&H000000FF"; // Red
                borderWidth = 2;
                shadowWidth = 2;
                break;
            case "modern-box":
            default:
                textColor = "&H00FFFFFF";
                backColor = "&HB0000000";
                borderStyle = 3;
                break;
        }
    } else if (captionStyle && typeof captionStyle === "object") {
        if (captionStyle.fontId && captionStyle.fontId !== "default") {
            fontName = captionStyle.fontId;
        }
        textColor = hexToAssColor(captionStyle.textColor || "#ffffff", 1);
        backColor = hexToAssColor(captionStyle.backgroundColor || "#000000", captionStyle.backgroundOpacity ?? 0.6);
        outlineColor = hexToAssColor(captionStyle.borderColor || "#000000", 1);
        borderWidth = captionStyle.borderWidth !== undefined ? Number(captionStyle.borderWidth) : 2;
        shadowWidth = captionStyle.shadowOpacity ? 2 : 0;
        
        if (captionStyle.backgroundColor && (captionStyle.backgroundOpacity ?? 0) > 0.05) {
            borderStyle = 3;
        }
    }

    const playX = isVertical ? 1080 : 1920;
    const playY = isVertical ? 1920 : 1080;
    const marginV = Math.round(playY * 0.25);

    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playX}
PlayResY: ${playY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${textColor},${textColor},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${borderWidth},${shadowWidth},2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const candidateWords = words.filter(w => w.end > startSec && w.start < endSec);
    
    const formatAssTime = (secs: number): string => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        const cs = Math.floor((secs % 1) * 100);
        const pad = (n: number, size: number) => n.toString().padStart(size, "0");
        return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
    };

    for (let i = 0; i < candidateWords.length; i += 2) {
        const chunk = candidateWords.slice(i, i + 2);
        if (chunk.length === 0) continue;
        const first = chunk[0];
        const last = chunk[chunk.length - 1];

        const startRel = Math.max(first.start - startSec, 0.0);
        const endRel = Math.max(Math.min(last.end - startSec, endSec - startSec), 0.0);
        if (endRel <= startRel) continue;

        const text = chunk.map(w => w.text.toUpperCase().replace(/[^A-Z0-9 !?]/g, "")).join(" ");
        
        ass += `Dialogue: 0,${formatAssTime(startRel)},${formatAssTime(endRel)},Default,,0,0,0,,${text}\n`;
    }

    return ass;
}

function escapeSubtitlePath(filePath: string): string {
    let resolved = path.resolve(filePath);
    resolved = resolved.replace(/\\/g, "/");
    resolved = resolved.replace(/^([a-zA-Z]):/, "$1\\:");
    return resolved;
}



