// Importing modules
import { exec } from "child_process";
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
                        audioCodec: audioStream ? audioStream.codec_name : null
                    };

                    resolve(result);
                } catch (parseErr: any) {
                    reject(new Error(`failed to parse ffprobe output: ${parseErr.message}`));
                }
            });
        });
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
            let tempCutPath: string | null = null;

            try {
                const parentDir = path.dirname(outputPath);
                fs.mkdirSync(parentDir, { recursive: true });

                const tempDir = path.resolve("./uploads/temp");
                fs.mkdirSync(tempDir, { recursive: true });

                const tempCutFilename = `temp-cut-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.mp4`;
                tempCutPath = path.join(tempDir, tempCutFilename);

                logger.info(`Pre-cutting source segment from ${startSec} to ${endSec}...`);
                await this.extractVideoSegment(sourcePath, startSec, endSec, tempCutPath);

                const { bundle } = await import("@remotion/bundler");
                const { selectComposition, renderMedia } = await import("@remotion/renderer");

                // dynamically resolve Remotion Root.tsx across dev (src) and production (dist)
                let rootPath = path.resolve("./src/shared/remotion/Root.tsx");
                if (!fs.existsSync(rootPath)) {
                    const fallbackRoot = path.resolve("./dist/src/shared/remotion/Root.tsx");
                    if (fs.existsSync(fallbackRoot)) {
                        rootPath = fallbackRoot;
                    } else {
                        const altRoot = path.resolve("./server/src/shared/remotion/Root.tsx");
                        if (fs.existsSync(altRoot)) rootPath = altRoot;
                    }
                }

                logger.info(`Bundling Remotion composition from ${rootPath}...`);

                const bundleLocation = await bundle({
                    entryPoint: rootPath
                });

                const durationFrames = Math.max(1, Math.ceil((endSec - startSec) * 30));
                const port = process.env.PORT || 5000;
                const videoUrl = `http://localhost:${port}/uploads/temp/${tempCutFilename}`;

                const aspectRatio = layoutOptions?.aspectRatio || "vertical";
                const isHorizontal = aspectRatio === "horizontal";
                const isSquare = aspectRatio === "square";
                const width = isHorizontal ? 1920 : 1080;
                const height = isHorizontal ? 1080 : isSquare ? 1080 : 1920;

                // Compute smart framing focus positioning
                let focusX = layoutOptions?.focusX !== undefined ? Number(layoutOptions.focusX) : 50;
                let focusY = layoutOptions?.focusY !== undefined ? Number(layoutOptions.focusY) : 50;
                let zoomFactor = layoutOptions?.zoomFactor !== undefined ? Number(layoutOptions.zoomFactor) : 1.0;

                const inputProps = {
                    videoUrl,
                    startSec,
                    endSec,
                    subwords,
                    stylePreset,
                    isPreCut: true,
                    layout: layoutOptions?.layout || "standard",
                    zoomFactor,
                    focusX,
                    focusY,
                    aspectRatio
                };

                // Find Chromium binary across various Linux distributions and environment variables
                let chromiumPath: string | undefined = undefined;
                if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
                    chromiumPath = process.env.CHROMIUM_PATH;
                } else if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
                    chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
                } else if (fs.existsSync("/usr/bin/chromium")) {
                    chromiumPath = "/usr/bin/chromium";
                } else if (fs.existsSync("/usr/bin/chromium-browser")) {
                    chromiumPath = "/usr/bin/chromium-browser";
                } else if (fs.existsSync("/usr/bin/google-chrome")) {
                    chromiumPath = "/usr/bin/google-chrome";
                }

                const comp = await selectComposition({
                    serveUrl: bundleLocation,
                    id: "VideoClip",
                    inputProps,
                    browserExecutable: chromiumPath
                });

                comp.durationInFrames = durationFrames;
                comp.width = width;
                comp.height = height;

                logger.info(`Rendering Remotion clip (${durationFrames} frames, ${width}x${height}) to ${outputPath}...`);

                await renderMedia({
                    composition: comp,
                    serveUrl: bundleLocation,
                    outputLocation: outputPath,
                    inputProps,
                    codec: "h264",
                    browserExecutable: chromiumPath,
                    chromiumOptions: {
                        args: [
                            "--no-sandbox",
                            "--disable-setuid-sandbox",
                            "--disable-dev-shm-usage",
                            "--disable-gpu"
                        ]
                    } as any
                });

                logger.info(`Remotion clip render completed successfully`);

                if (tempCutPath && fs.existsSync(tempCutPath)) {
                    try { fs.unlinkSync(tempCutPath); } catch {}
                }

                resolve(outputPath);
            } catch (err: any) {
                logger.error(`Remotion clip render failed: ${err.message}`);

                if (tempCutPath && fs.existsSync(tempCutPath)) {
                    try { fs.unlinkSync(tempCutPath); } catch {}
                }

                reject(err);
            }
        });
    }

}

export default MediaService;
