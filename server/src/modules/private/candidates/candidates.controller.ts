// Importing modules
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import * as archiverModule from "archiver";
import CandidateDao from "../../../shared/dao/candidate.dao.js";
import ProjectDao from "../../../shared/dao/project.dao.js";
import TranscriptDao from "../../../shared/dao/transcript.dao.js";
import ClipDao from "../../../shared/dao/clip.dao.js";
import UserDao from "../../../shared/dao/user.dao.js";
import MediaService from "../../../shared/services/media.service.js";
import GoogleDriveService from "../../../shared/services/googleDrive.service.js";
import Forbidden from "../../../shared/errors/Forbidden.error.js";
import { generateSrt, buildDrawtextFilters } from "../../../shared/utils/subtitles.util.js";
import Ok from "../../../shared/responses/Ok.response.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import logger from "../../../shared/config/logger.config.js";
import { Request, Response } from "express";

// class to handle clip candidate cutting and rendering operations
class CandidatesController {

    candidateDao: CandidateDao;
    projectDao: ProjectDao;
    transcriptDao: TranscriptDao;
    clipDao: ClipDao;
    userDao: UserDao;
    mediaService: MediaService;
    googleDriveService: GoogleDriveService;

    constructor() {

        // initializing the DAOs
        this.candidateDao = new CandidateDao();
        this.projectDao = new ProjectDao();
        this.transcriptDao = new TranscriptDao();
        this.clipDao = new ClipDao();
        this.userDao = new UserDao();

        // initializing services
        this.mediaService = new MediaService();
        this.googleDriveService = new GoogleDriveService();

    }


    // render a vertical short flat clip for a single candidate
    cutCandidate = async (req: Request, res: Response) => {

        const { candidateId } = req.params;
        const userId = (req as any).user?.userId;

        // fetching candidate details
        const candidate = await this.candidateDao.findCandidateById(candidateId);

        if (!candidate) {

            throw new NotFound("Candidate not found");

        }

        // fetching parent project
        const project = await this.projectDao.findProjectById(candidate.projectId);

        if (!project) {

            throw new NotFound("Parent project not found");

        }

        // verify user ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }

        const existingClip = await this.clipDao.findClipByCandidateId(candidateId);

        const { captionStyle, layout, zoomFactor, focusX, focusY, aspectRatio } = req.body;

        const style = captionStyle || existingClip?.captionStyle || project.captionStyle || "modern-box";
        const selectedLayout = layout || existingClip?.layout || "standard";
        const selectedZoomFactor = zoomFactor !== undefined ? Number(zoomFactor) : (existingClip?.zoomFactor !== undefined ? existingClip.zoomFactor : 1.0);
        const selectedFocusX = focusX !== undefined ? Number(focusX) : (existingClip?.focusX !== undefined ? existingClip.focusX : 50);
        const selectedFocusY = focusY !== undefined ? Number(focusY) : (existingClip?.focusY !== undefined ? existingClip.focusY : 50);
        const selectedAspectRatio = aspectRatio || existingClip?.aspectRatio || "vertical";

        // updating clip status to cutting
        await this.clipDao.updateClipByCandidateId(candidateId, { 
            status: "cutting",
            captionStyle: style,
            layout: selectedLayout,
            zoomFactor: selectedZoomFactor,
            focusX: selectedFocusX,
            focusY: selectedFocusY,
            aspectRatio: selectedAspectRatio
        });

        // setting file paths
        const projectDir = `./uploads/projects/${project._id}`;
        const outputClipPathVertical = path.join(projectDir, "clips", `clip-${candidate.rank.toString().padStart(2, "0")}_vertical.mp4`);
        const outputClipPathHorizontal = path.join(projectDir, "clips", `clip-${candidate.rank.toString().padStart(2, "0")}_horizontal.mp4`);

        let srtPathString = null;
        let candidateWords = [];

        // generating SRT and candidate words list from latest transcript record
        const transcriptRecord = await this.transcriptDao.findTranscriptByProjectId(project._id);

        if (transcriptRecord) {

            try {

                const transcript = JSON.parse(transcriptRecord.rawJson);
                const words = transcript.words || [];

                // filter words that overlap with candidate start and end
                candidateWords = words.filter(w => w.end > candidate.startSec && w.start < candidate.endSec);

                // 1. generate SRT file content
                const srtContent = generateSrt(words, candidate.startSec, candidate.endSec);

                // ensuring parent dir exists
                fs.mkdirSync(path.join(projectDir, "clips"), { recursive: true });

                const clipSrtPath = path.join(projectDir, `clip-${candidate._id}.srt`);
                fs.writeFileSync(clipSrtPath, srtContent);
                srtPathString = clipSrtPath;

            }
            catch (subErr) {

                logger.warn(`subtitle extraction failed: ${subErr.message}`);

            }

        }

        const user = await this.userDao.findUserById(userId);
        let drive = null;
        let driveToken = null;

        if (user && user.googleAccessToken) {
            driveToken = await this.googleDriveService.getValidUserToken(user);
            drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        } else {
            drive = this.googleDriveService.getCentralDriveClient();
            if (drive) {
                try {
                    const authClient = (drive as any).context._options.auth;
                    const tokenResponse = await authClient.getAccessToken();
                    driveToken = tokenResponse.token || null;
                } catch {}
            }
        }

        const localVideoPath = path.join(projectDir, "source_video.mp4");

        try {

            fs.mkdirSync(projectDir, { recursive: true });

            if (!fs.existsSync(localVideoPath)) {
                logger.info(`Downloading video from GDrive for clip rendering: ${project.driveFileId}`);
                await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
            }

            // Resolve Google Drive project subfolder ID if drive client is active
            let projectFolderId: string | undefined = undefined;
            if (drive) {
                const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
            }

            // Upload the clip SRT file to Google Drive project subfolder if it exists
            if (drive && srtPathString && fs.existsSync(srtPathString)) {
                const srtFilename = `clip-${candidate.rank.toString().padStart(2, "0")}.srt`;
                await this.googleDriveService.uploadFile(
                    drive,
                    srtPathString,
                    srtFilename,
                    "text/plain",
                    "AutoShorts Studio",
                    undefined,
                    projectFolderId
                );
                logger.info(`Uploaded clip SRT subtitle track "${srtFilename}" to Google Drive project folder`);
            }

            // 1. Render Vertical Clip using Remotion
            logger.info(`Rendering vertical 9:16 clip for candidate ${candidate.rank}`);
            const renderPathVertical = await this.mediaService.renderRemotionClip(
                localVideoPath,
                candidate.startSec,
                candidate.endSec,
                outputClipPathVertical,
                candidateWords,
                style,
                {
                    layout: selectedLayout,
                    zoomFactor: selectedZoomFactor,
                    focusX: selectedFocusX,
                    focusY: selectedFocusY,
                    aspectRatio: "vertical"
                }
            );

            // Upload Vertical to Drive
            let driveClipResultVertical = null;
            if (drive) {
                const clipFilename = `clip-${candidate.rank.toString().padStart(2, "0")}_vertical.mp4`;
                driveClipResultVertical = await this.googleDriveService.uploadFile(
                    drive,
                    renderPathVertical as string,
                    clipFilename,
                    "video/mp4",
                    "AutoShorts Studio",
                    undefined,
                    projectFolderId
                );
            }

            // 2. Render Horizontal Clip using Remotion
            logger.info(`Rendering horizontal 16:9 clip for candidate ${candidate.rank}`);
            const renderPathHorizontal = await this.mediaService.renderRemotionClip(
                localVideoPath,
                candidate.startSec,
                candidate.endSec,
                outputClipPathHorizontal,
                candidateWords,
                style,
                {
                    layout: "standard",
                    zoomFactor: 1.0,
                    focusX: 50,
                    focusY: 50,
                    aspectRatio: "horizontal"
                }
            );

            // Upload Horizontal to Drive
            let driveClipResultHorizontal = null;
            if (drive) {
                const clipFilename = `clip-${candidate.rank.toString().padStart(2, "0")}_horizontal.mp4`;
                driveClipResultHorizontal = await this.googleDriveService.uploadFile(
                    drive,
                    renderPathHorizontal as string,
                    clipFilename,
                    "video/mp4",
                    "AutoShorts Studio",
                    undefined,
                    projectFolderId
                );
            }

            // Delete the local rendered clip files immediately to save disk
            try {
                if (fs.existsSync(renderPathVertical as string)) fs.unlinkSync(renderPathVertical as string);
                if (fs.existsSync(renderPathHorizontal as string)) fs.unlinkSync(renderPathHorizontal as string);
            } catch (delErr: any) {
                logger.warn(`Failed to delete local clip renders: ${delErr.message}`);
            }

            // updating clip status to done
            const clip = await this.clipDao.updateClipByCandidateId(candidateId, {
                status: "done",
                outputPath: renderPathVertical,
                outputPathHorizontal: renderPathHorizontal,
                captionAssPath: srtPathString,
                captionStyle: style,
                layout: selectedLayout,
                zoomFactor: selectedZoomFactor,
                focusX: selectedFocusX,
                focusY: selectedFocusY,
                aspectRatio: "both",
                renderLog: "Rendered both 9:16 and 16:9 versions successfully with Remotion dynamic captions overlay",
                driveFileId: driveClipResultVertical?.fileId || null,
                driveUrl: driveClipResultVertical?.webViewLink || null,
                driveFileIdHorizontal: driveClipResultHorizontal?.fileId || null,
                driveUrlHorizontal: driveClipResultHorizontal?.webViewLink || null
            });

            return Ok(res, "Clips cut successfully in both aspect ratios using Remotion composition", clip);

        }
        catch (renderErr: any) {

            const errMessage = renderErr.message;
            logger.warn(`Primary Remotion render failed, retrying simple FFmpeg cut without overlays: ${errMessage}`);

            try {

                // Resolve Google Drive project subfolder ID if drive client is active
                let projectFolderId: string | undefined = undefined;
                if (drive) {
                    const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                    projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
                }

                // 1. Render Fallback Vertical Flat Clip
                const renderPathNoCapsVertical = await this.mediaService.renderFlatClip(
                    localVideoPath,
                    candidate.startSec,
                    candidate.endSec,
                    outputClipPathVertical,
                    null,
                    "vertical",
                    { focusX: selectedFocusX, focusY: selectedFocusY, zoomFactor: selectedZoomFactor }
                );

                // Upload Vertical Fallback to Drive
                let driveClipResultVertical = null;
                if (drive) {
                    const clipFilename = `clip-${candidate.rank.toString().padStart(2, "0")}_vertical_flat.mp4`;
                    driveClipResultVertical = await this.googleDriveService.uploadFile(
                        drive,
                        renderPathNoCapsVertical as string,
                        clipFilename,
                        "video/mp4",
                        "AutoShorts Studio",
                        undefined,
                        projectFolderId
                    );
                }

                // 2. Render Fallback Horizontal Flat Clip
                const renderPathNoCapsHorizontal = await this.mediaService.renderFlatClip(
                    localVideoPath,
                    candidate.startSec,
                    candidate.endSec,
                    outputClipPathHorizontal,
                    null,
                    "horizontal"
                );

                // Upload Horizontal Fallback to Drive
                let driveClipResultHorizontal = null;
                if (drive) {
                    const clipFilename = `clip-${candidate.rank.toString().padStart(2, "0")}_horizontal_flat.mp4`;
                    driveClipResultHorizontal = await this.googleDriveService.uploadFile(
                        drive,
                        renderPathNoCapsHorizontal as string,
                        clipFilename,
                        "video/mp4",
                        "AutoShorts Studio",
                        undefined,
                        projectFolderId
                    );
                }

                const warningMsg = `Clips rendered successfully, but captions overlay was skipped. Error: ${errMessage}`;

                // Delete the local rendered clip files immediately to save disk
                try {
                    if (fs.existsSync(renderPathNoCapsVertical as string)) fs.unlinkSync(renderPathNoCapsVertical as string);
                    if (fs.existsSync(renderPathNoCapsHorizontal as string)) fs.unlinkSync(renderPathNoCapsHorizontal as string);
                } catch (delErr: any) {
                    logger.warn(`Failed to delete local fallback clip renders: ${delErr.message}`);
                }

                const clip = await this.clipDao.updateClipByCandidateId(candidateId, {
                    status: "done",
                    outputPath: renderPathNoCapsVertical,
                    outputPathHorizontal: renderPathNoCapsHorizontal,
                    captionAssPath: srtPathString,
                    layout: selectedLayout,
                    zoomFactor: selectedZoomFactor,
                    focusX: selectedFocusX,
                    focusY: selectedFocusY,
                    aspectRatio: "both",
                    renderLog: warningMsg,
                    driveFileId: driveClipResultVertical?.fileId || null,
                    driveUrl: driveClipResultVertical?.webViewLink || null,
                    driveFileIdHorizontal: driveClipResultHorizontal?.fileId || null,
                    driveUrlHorizontal: driveClipResultHorizontal?.webViewLink || null
                });

                return Ok(res, "Clips cut successfully in both aspect ratios without captions overlay", clip);

            }
            catch (retryErr: any) {

                const finalMessage = retryErr.message;
                logger.error(`final clip render failed: ${finalMessage}`);

                // update status to error
                const clip = await this.clipDao.updateClipByCandidateId(candidateId, {
                    status: "error",
                    renderLog: finalMessage
                });

                throw new Error(`Rendering failed: ${finalMessage}`);

            }

        }
        finally {
            // Keep source_video.mp4 locally; do not delete it from disk
        }

    }

    // sequentially cut all selected candidates for a project
    cutSelected = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify user ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }

        const { candidateStyles } = req.body;


        // fetch all candidates for this project
        const candidates = await this.candidateDao.findCandidatesByProjectId(projectId);
        const selected = candidates.filter(c => c.selected === true);

        if (selected.length === 0) {

            throw new BadRequest("No candidates are selected for cutting");

        }

        // processing clips sequentially in the background
        const processClips = async () => {

            for (const candidate of selected) {

                try {

                    // reuse the single candidate cut logic function
                    const mockReq = { 
                        params: { candidateId: candidate._id.toString() },
                        body: { captionStyle: candidateStyles?.[candidate._id.toString()] }
                    };
                    const mockRes = {
                        status: () => ({ json: () => {} })
                    };

                    await this.cutCandidate(mockReq as any, mockRes as any);

                }
                catch (err) {

                    logger.error(`sequenced render failed for candidate ${candidate._id}: ${err.message}`);

                }

            }

        };

        // start background processing
        processClips();

        return Ok(res, "Selected candidate cutting initiated in background");

    }

    // update custom layout configuration for a candidate clip
    updateLayout = async (req: Request, res: Response) => {

        const { candidateId } = req.params;
        const userId = (req as any).user?.userId;
        const { layout, zoomFactor, focusX, focusY, aspectRatio } = req.body;

        const candidate = await this.candidateDao.findCandidateById(candidateId);
        if (!candidate) throw new NotFound("Candidate not found");

        const project = await this.projectDao.findProjectById(candidate.projectId);
        if (!project) throw new NotFound("Parent project not found");

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const updateData: any = {};
        if (layout !== undefined) updateData.layout = layout;
        if (zoomFactor !== undefined) updateData.zoomFactor = Number(zoomFactor);
        if (focusX !== undefined) updateData.focusX = Number(focusX);
        if (focusY !== undefined) updateData.focusY = Number(focusY);
        if (aspectRatio !== undefined) updateData.aspectRatio = aspectRatio;

        const clip = await this.clipDao.updateClipByCandidateId(candidateId, updateData);
        if (!clip) throw new NotFound("Associated clip not found");

        return Ok(res, "Layout options updated successfully", clip);

    };

    // export candidate clip project as CapCut desktop draft folder compressed in a ZIP
    exportCapcutDraft = async (req: Request, res: Response) => {

        const { candidateId } = req.params;
        const userId = (req as any).user?.userId;
        const includeVideo = req.query.includeVideo === "true"; // default false

        const candidate = await this.candidateDao.findCandidateById(candidateId);
        if (!candidate) throw new NotFound("Candidate not found");

        const project = await this.projectDao.findProjectById(candidate.projectId);
        if (!project) throw new NotFound("Parent project not found");

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const projectDir = `./uploads/projects/${project._id}`;
        const localVideoPath = path.join(projectDir, "source_video.mp4");

        // 1. Download video if not locally stored
        if (!fs.existsSync(localVideoPath)) {
            const user = await this.userDao.findUserById(userId);
            let drive = null;
            let driveToken = null;
            if (user && user.googleAccessToken) {
                driveToken = await this.googleDriveService.getValidUserToken(user);
                drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
            } else {
                drive = this.googleDriveService.getCentralDriveClient();
            }
            if (!drive) {
                throw new BadRequest("No Google Drive configuration found to download the video.");
            }
            logger.info(`Downloading video from GDrive for CapCut draft: ${project.driveFileId}`);
            fs.mkdirSync(projectDir, { recursive: true });
            await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
        }

        // 2. Fetch layout options
        const existingClip = await this.clipDao.findClipByCandidateId(candidateId);
        const selectedAspectRatio = existingClip?.aspectRatio || "vertical";
        const selectedZoomFactor = existingClip?.zoomFactor || 1.0;

        // 3. Generate subtitles SRT
        const transcriptRecord = await this.transcriptDao.findTranscriptByProjectId(project._id);
        const srtContent = generateSrt(transcriptRecord ? JSON.parse(transcriptRecord.rawJson).words || [] : [], candidate.startSec, candidate.endSec);
        const tempSrtDir = `./uploads/temp/capcut-srt-${Date.now()}`;
        fs.mkdirSync(tempSrtDir, { recursive: true });
        const tempSrtPath = path.join(tempSrtDir, "clip.srt");
        fs.writeFileSync(tempSrtPath, srtContent);

        // 4. Run CapCut CLI quickstart in a temporary folder
        const tempDraftParentDir = path.resolve(`./uploads/temp/capcut-draft-${Date.now()}`);
        fs.mkdirSync(tempDraftParentDir, { recursive: true });
        const draftName = `Candidate_${candidate.rank}_Edit`;

        const cmd = `npx -y capcut-cli quickstart "${draftName}" --video "${path.resolve(localVideoPath)}" --srt "${path.resolve(tempSrtPath)}" --drafts "${tempDraftParentDir}"`;
        logger.info(`Executing capcut-cli: ${cmd}`);

        try {
            await new Promise<void>((resolve, reject) => {
                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(`capcut-cli error: ${stderr || error.message}`);
                        return reject(new Error(stderr || error.message));
                    }
                    resolve();
                });
            });

            const draftFolder = path.join(tempDraftParentDir, draftName);
            const contentJsonPath = path.join(draftFolder, "draft_content.json");
            const infoJsonPath = path.join(draftFolder, "draft_info.json");
            const metaJsonPath = path.join(draftFolder, "draft_meta_info.json");

            const durationMicro = Math.round((candidate.endSec - candidate.startSec) * 1000000);
            const startMicro = Math.round(candidate.startSec * 1000000);

            // 5. Update draft JSON files to set trim boundaries, canvas layout, and zoom
            const updateDraftJson = (filePath: string) => {
                if (!fs.existsSync(filePath)) return;
                const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

                // update project duration
                data.duration = durationMicro;

                // update aspect ratio and canvas dimensions
                const isHorizontal = selectedAspectRatio === "horizontal";
                data.canvas_config = {
                    width: isHorizontal ? 1920 : 1080,
                    height: isHorizontal ? 1080 : 1920,
                    ratio: isHorizontal ? "16:9" : "9:16"
                };

                // update video segment timings and zoom
                if (data.tracks && data.tracks.length > 0) {
                    const videoTrack = data.tracks.find((t: any) => t.type === "video");
                    if (videoTrack && videoTrack.segments && videoTrack.segments.length > 0) {
                        const mainSegment = videoTrack.segments[0];
                        mainSegment.source_timerange = { start: startMicro, duration: durationMicro };
                        mainSegment.target_timerange = { start: 0, duration: durationMicro };
                        
                        // Apply custom zoom factor
                        if (mainSegment.clip) {
                            mainSegment.clip.scale = { x: selectedZoomFactor, y: selectedZoomFactor };
                        }
                    }
                }

                // If not including the video file, make the path relative so the user can easily link/drop their video
                if (!includeVideo) {
                    if (data.materials && data.materials.videos && data.materials.videos.length > 0) {
                        data.materials.videos[0].path = "assets/video/source_video.mp4";
                    }
                }

                fs.writeFileSync(filePath, JSON.stringify(data));
            };

            updateDraftJson(contentJsonPath);
            updateDraftJson(infoJsonPath);

            // Update meta file
            if (fs.existsSync(metaJsonPath)) {
                const meta = JSON.parse(fs.readFileSync(metaJsonPath, "utf-8"));
                meta.draft_fold_path = "";
                meta.draft_json_file = "";
                meta.draft_root_path = "";
                meta.tm_duration = durationMicro;
                fs.writeFileSync(metaJsonPath, JSON.stringify(meta));
            }

            // 6. If without video, delete the copied video file to make the zip lightweight
            if (!includeVideo) {
                const videoAssetPath = path.join(draftFolder, "assets", "video", "source_video.mp4");
                if (fs.existsSync(videoAssetPath)) {
                    fs.unlinkSync(videoAssetPath);
                }
            }

            // 7. Zip the folder and return as file download
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename="${draftName}${includeVideo ? "_full" : ""}.zip"`);

            const archiver = ((archiverModule as any).default || archiverModule) as any;
            const archive = archiver("zip", { zlib: { level: 9 } });
            archive.on("error", (zipErr) => {
                throw zipErr;
            });

            archive.pipe(res);
            archive.directory(draftFolder, false);
            await archive.finalize();

        } finally {
            // Clean up temporary files in background
            setTimeout(() => {
                try {
                    fs.rmSync(tempSrtDir, { recursive: true, force: true });
                    fs.rmSync(tempDraftParentDir, { recursive: true, force: true });
                } catch (cleanErr: any) {
                    logger.warn(`Failed to clean up temporary CapCut files: ${cleanErr.message}`);
                }
            }, 5000);
        }
    };

    downloadCandidateClip = async (req: Request, res: Response) => {
        const { candidateId } = req.params;

        const candidate = await this.candidateDao.findCandidateById(candidateId);
        if (!candidate) throw new NotFound("Candidate not found");

        const project = await this.projectDao.findProjectById(candidate.projectId.toString());
        if (!project) throw new NotFound("Project not found");

        const projectDir = `./uploads/projects/${project._id}`;
        const localVideoPath = path.join(projectDir, "source_video.mp4");
        const renderedClip = path.join(projectDir, "clips", `clip-${candidate.rank.toString().padStart(2, "0")}_vertical.mp4`);

        const cleanTitle = (candidate.title || `Short_${candidate.rank}`)
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .substring(0, 40);
        const downloadName = `${cleanTitle}_9x16.mp4`;

        // If rendered file exists, stream it directly
        if (fs.existsSync(renderedClip)) {
            const stat = fs.statSync(renderedClip);
            res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader("Content-Length", stat.size.toString());
            return fs.createReadStream(renderedClip).pipe(res);
        }

        // Otherwise, render on-the-fly with ffmpeg
        if (!fs.existsSync(localVideoPath)) {
            throw new NotFound("Source video not found on server");
        }

        fs.mkdirSync(path.join(projectDir, "clips"), { recursive: true });

        // Use the correct model fields: startSec and endSec
        const startSec = Number(candidate.startSec) || 0;
        const endSec = Number(candidate.endSec) || (startSec + 30);
        const duration = endSec - startSec;

        logger.info(`Download clip: "${candidate.title}" from ${startSec}s to ${endSec}s (${duration}s) for project ${project._id}`);

        if (duration <= 0 || duration > 600) {
            return res.status(400).json({ status: "error", message: `Invalid clip duration: ${duration}s (start: ${startSec}, end: ${endSec})` });
        }

        const outFile = path.join(projectDir, "clips", `download_${candidate._id}.mp4`);

        // Smart 9:16 vertical crop:
        // 1. First probe the source to get dimensions
        const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${localVideoPath}"`;

        exec(probeCmd, { timeout: 10000 }, (probeErr, probeOut) => {
            let vfFilter: string;

            if (!probeErr && probeOut?.trim()) {
                const [srcW, srcH] = probeOut.trim().split("x").map(Number);
                const srcAspect = srcW / srcH;

                if (srcAspect > 1) {
                    // Landscape source (16:9, etc): crop center column at 9:16 aspect then scale to 1080x1920
                    // Crop width = height * 9/16 (takes center vertical strip focused on speaker)
                    const cropW = Math.round(srcH * 9 / 16);
                    const cropX = Math.round((srcW - cropW) / 2);
                    vfFilter = `crop=${cropW}:${srcH}:${cropX}:0,scale=1080:1920`;
                } else {
                    // Already portrait or square: just scale
                    vfFilter = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;
                }
            } else {
                // Fallback: center crop assuming 16:9
                vfFilter = `crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0,scale=1080:1920`;
            }

            const cmd = `ffmpeg -y -ss ${startSec.toFixed(3)} -t ${duration.toFixed(3)} -i "${localVideoPath}" -vf "${vfFilter}" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -movflags +faststart "${outFile}"`;

            logger.info(`Running ffmpeg download render: ${cmd}`);

            exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
                if (err || !fs.existsSync(outFile)) {
                    logger.error(`FFmpeg download render failed: ${stderr || err?.message}`);
                    return res.status(500).json({ status: "error", message: "Failed to render clip for download" });
                }

                const stat = fs.statSync(outFile);
                logger.info(`Download clip rendered: ${outFile} (${(stat.size / (1024 * 1024)).toFixed(1)} MB, ${duration.toFixed(1)}s)`);

                res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
                res.setHeader("Content-Type", "video/mp4");
                res.setHeader("Content-Length", stat.size.toString());

                const stream = fs.createReadStream(outFile);
                stream.pipe(res);
                stream.on("close", () => {
                    // Clean up after 30 seconds (allow streaming to complete)
                    setTimeout(() => {
                        try { fs.unlinkSync(outFile); } catch {}
                    }, 30000);
                });
            });
        });
    };

}

export default CandidatesController;
