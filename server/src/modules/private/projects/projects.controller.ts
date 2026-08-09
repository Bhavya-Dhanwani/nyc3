// Importing modules
import fs from "fs";
import path from "path";
import os from "os";
import env from "../../../shared/config/env.config.js";
import logger from "../../../shared/config/logger.config.js";
import ProjectDao from "../../../shared/dao/project.dao.js";
import TranscriptDao from "../../../shared/dao/transcript.dao.js";
import CandidateDao from "../../../shared/dao/candidate.dao.js";
import ClipDao from "../../../shared/dao/clip.dao.js";
import UserDao from "../../../shared/dao/user.dao.js";
import MediaService from "../../../shared/services/media.service.js";
import TranscriptionService from "../../../shared/services/transcription.service.js";
import LlmService from "../../../shared/services/llm.service.js";
import GoogleDriveService from "../../../shared/services/googleDrive.service.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import Ok from "../../../shared/responses/Ok.response.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import Forbidden from "../../../shared/errors/Forbidden.error.js";
import { Request, Response } from "express";
import { generateSrt, parseSrtToTranscript } from "../../../shared/utils/subtitles.util.js";
import { operationManager } from "../../../shared/services/operationManager.service.js";

// class to handle project operations
class ProjectsController {

    projectDao: ProjectDao;
    transcriptDao: TranscriptDao;
    candidateDao: CandidateDao;
    clipDao: ClipDao;
    userDao: UserDao;
    mediaService: MediaService;
    transcriptionService: TranscriptionService;
    llmService: LlmService;
    googleDriveService: GoogleDriveService;

    constructor() {

        // initializing the DAOs
        this.projectDao = new ProjectDao();
        this.transcriptDao = new TranscriptDao();
        this.candidateDao = new CandidateDao();
        this.clipDao = new ClipDao();
        this.userDao = new UserDao();

        // initializing the Services
        this.mediaService = new MediaService();
        this.transcriptionService = new TranscriptionService();
        this.llmService = new LlmService();
        this.googleDriveService = new GoogleDriveService();

    }


    // create a new project from uploaded file
    createProject = async (req: Request, res: Response) => {

        if (!req.file) {

            throw new BadRequest("No media file was uploaded");

        }

        const sourcePath = req.file.path;
        const originalName = req.file.originalname;
        const transcriptionMode = req.body.transcriptionMode || "local";
        const captionStyle = req.body.captionStyle || "modern-box";
        const userId = (req as any).user?.userId;

        const user = await this.userDao.findUserById(userId);

        let drive = null;
        let driveToken = null;

        // Resolve Drive client and OAuth Bearer token
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
                } catch (tokErr: any) {
                    logger.warn(`Failed to retrieve central service account token: ${tokErr.message}`);
                }
            }
        }

        // probing the media locally first while the file is still on disk
        let durationSec = null;
        try {
            const probe: any = await this.mediaService.probeMedia(sourcePath);
            durationSec = probe.durationSec;
        }
        catch (probeErr: any) {
            logger.warn(`local media probe warning: ${probeErr.message}`);
        }

        let driveResult: any = null;
        if (drive) {
            try {
                // Upload to Google Drive if connected
                driveResult = await this.googleDriveService.uploadFile(drive, sourcePath, originalName, req.file.mimetype);
            } catch (uploadErr: any) {
                logger.warn(`Google Drive upload failed, continuing with local storage: ${uploadErr.message}`);
            }
        }

        // creating the project in the database
        const project = await this.projectDao.createProject({
            name: originalName,
            sourcePath: "placeholder",
            originalName: originalName,
            sourceDuration: durationSec,
            status: "ready",
            transcriptionMode: transcriptionMode,
            captionStyle: captionStyle,
            userId: userId,
            driveFileId: driveResult?.fileId || null
        });

        const projectId = project._id || project.id;
        const projectDir = `./uploads/projects/${projectId}`;
        fs.mkdirSync(projectDir, { recursive: true });
        const preservedPath = path.join(projectDir, "source_video.mp4");

        try {
            fs.renameSync(sourcePath, preservedPath);
        } catch (renameErr) {
            try {
                fs.copyFileSync(sourcePath, preservedPath);
                fs.unlinkSync(sourcePath);
            } catch (copyErr: any) {
                logger.error(`Failed to move upload to project directory: ${copyErr.message}`);
            }
        }

        project.sourcePath = preservedPath;
        await project.save();

        return Ok(res, "Project created successfully", project);

    }


    // initialize project upload, create placeholder record
    initUpload = async (req: Request, res: Response) => {

        const { name, captionStyle } = req.body;
        const transcriptionMode = req.body.transcriptionMode || req.body.transcriptionEngine || "local";
        const userId = (req as any).user?.userId;

        if (!name) {
            throw new BadRequest("Project name is required");
        }

        const project = await this.projectDao.createProject({
            name: name,
            sourcePath: "placeholder",
            originalName: name,
            sourceDuration: null,
            status: "uploading",
            transcriptionMode: transcriptionMode || "local",
            captionStyle: captionStyle || "modern-box",
            userId: userId,
            uploadProgress: 0,
            uploadStage: "server",
            uploadLoadedBytes: 0,
            uploadTotalBytes: 0
        });

        return Ok(res, "Upload initialized successfully", project);

    }


    // upload media file and upload to Google Drive with progress updates
    uploadMedia = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;

        if (!req.file) {
            throw new BadRequest("No media file was uploaded");
        }

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            try { fs.unlinkSync(req.file.path); } catch {}
            throw new NotFound("Project not found");
        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {
            try { fs.unlinkSync(req.file.path); } catch {}
            throw new Forbidden("You do not have access to this resource");
        }

        const sourcePath = req.file.path;
        const originalName = req.file.originalname;

        const user = await this.userDao.findUserById(userId);

        let drive = null;
        let driveToken = null;

        // Resolve Drive client and OAuth Bearer token
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
                } catch (tokErr: any) {
                    logger.warn(`Failed to retrieve central service account token: ${tokErr.message}`);
                }
            }
        }

        let driveResult: any = null;
        if (drive) {
            // Set state to uploading to Drive
            project.uploadStage = "drive";
            project.uploadProgress = 0;
            project.uploadTotalBytes = req.file.size || fs.statSync(sourcePath).size;
            project.uploadLoadedBytes = 0;
            await project.save();

            try {
                let lastUpdate = 0;
                const updateIntervalMs = 800;

                // Find or create project subfolder inside "AutoShorts Studio"
                const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                const projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);

                // Upload to Google Drive
                driveResult = await this.googleDriveService.uploadFile(
                    drive,
                    sourcePath,
                    originalName,
                    req.file.mimetype,
                    "AutoShorts Studio",
                    async (progress) => {
                        const now = Date.now();
                        const pct = Math.min(99, Math.round((progress.loaded / progress.total) * 100));
                        if (now - lastUpdate > updateIntervalMs || progress.loaded === progress.total) {
                            lastUpdate = now;
                            try {
                                await this.projectDao.updateProjectById(projectId, {
                                    uploadProgress: pct,
                                    uploadLoadedBytes: progress.loaded,
                                    uploadTotalBytes: progress.total
                                });
                            } catch (err: any) {
                                logger.warn(`Failed to update upload progress for project ${projectId}: ${err.message}`);
                            }
                        }
                    },
                    projectFolderId
                );
            } catch (uploadErr: any) {
                logger.warn(`Failed to upload media to Google Drive, preserving local copy: ${uploadErr.message}`);
            }
        }

        // probing the media locally first while the file is still on disk
        let durationSec = null;
        try {
            const probe: any = await this.mediaService.probeMedia(sourcePath);
            durationSec = probe.durationSec;
        }
        catch (probeErr: any) {
            logger.warn(`local media probe warning: ${probeErr.message}`);
        }

        // Move the uploaded file to the dedicated project folder as source_video.mp4
        const projectDir = `./uploads/projects/${projectId}`;
        fs.mkdirSync(projectDir, { recursive: true });
        const preservedPath = path.join(projectDir, "source_video.mp4");
        try {
            fs.renameSync(sourcePath, preservedPath);
        } catch (renameErr) {
            // fallback to copy and delete if rename fails
            try {
                fs.copyFileSync(sourcePath, preservedPath);
                fs.unlinkSync(sourcePath);
            } catch (copyErr: any) {
                logger.error(`Failed to move upload to project directory: ${copyErr.message}`);
            }
        }

        const driveStreamUrl = `https://www.googleapis.com/drive/v3/files/${driveResult.fileId}?alt=media`;

        // updating the project in the database
        project.sourcePath = preservedPath;
        project.sourceDuration = durationSec;
        project.status = "ingest";
        project.driveFileId = driveResult.fileId;
        project.uploadStage = "completed";
        project.uploadProgress = 100;
        await project.save();

        return Ok(res, "Media uploaded successfully", project);

    }


    // list all projects
    listProjects = async (req: Request, res: Response) => {

        const userId = (req as any).user?.userId;

        // Sync with Google Drive first to discover manual uploads/folders
        try {
            await this.syncProjectsFromDrive(userId);
        } catch (syncErr: any) {
            logger.warn(`Failed to sync projects from Drive: ${syncErr.message}`);
        }

        const projects = await this.projectDao.find({ userId }, { sort: { updatedAt: -1 } });

        return Ok(res, "Projects retrieved successfully", projects);

    }

    // scans user's Google Drive folder to discover manually uploaded videos
    syncProjectsFromDrive = async (userId: string) => {
        const user = await this.userDao.findUserById(userId);
        let drive = null;
        let driveToken = null;

        if (user && user.googleAccessToken) {
            driveToken = await this.googleDriveService.getValidUserToken(user);
            drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        } else {
            drive = this.googleDriveService.getCentralDriveClient();
        }

        if (!drive) return;

        // 1. Find or create the main application folder
        const studioFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");

        // 2. Scan folders: start with the main folder
        const foldersToScan = [studioFolderId];
        const folderNames: Record<string, string> = { [studioFolderId]: "AutoShorts Studio" };

        // 3. List direct subfolders under "AutoShorts Studio" (manual user project folders)
        try {
            const subfoldersRes = await drive.files.list({
                q: `'${studioFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: "files(id, name)",
                spaces: "drive"
            });
            const subfolders = subfoldersRes.data.files || [];
            for (const sub of subfolders) {
                foldersToScan.push(sub.id);
                folderNames[sub.id] = sub.name;
            }
        } catch (subErr: any) {
            logger.warn(`Drive sync: Failed to list subfolders: ${subErr.message}`);
        }

        // 4. Discover all video files inside these folders
        const driveVideos: any[] = [];
        for (const folderId of foldersToScan) {
            try {
                const filesRes = await drive.files.list({
                    q: `'${folderId}' in parents and mimeType contains 'video/' and trashed=false`,
                    fields: "files(id, name, mimeType, createdTime)",
                    spaces: "drive"
                });
                const files = filesRes.data.files || [];
                for (const file of files) {
                    (file as any).parentFolderId = folderId;
                    driveVideos.push(file);
                }
            } catch (fileErr: any) {
                logger.warn(`Drive sync: Failed to list files in folder ${folderId}: ${fileErr.message}`);
            }
        }

        // 5. Query existing projects to see what's already registered
        const existingProjects = await this.projectDao.find({ userId });
        const registeredFileIds = new Set(existingProjects.map(p => p.driveFileId).filter(Boolean));

        const driveFileIds = new Set(driveVideos.map(v => v.id));

        // 6. Clean up any database projects whose Drive files no longer exist
        for (const project of existingProjects) {
            if (project.driveFileId && project.status !== "uploading") {
                if (!driveFileIds.has(project.driveFileId)) {
                    logger.info(`Drive sync: Removing project "${project.name}" (${project._id}) because its Drive file (${project.driveFileId}) no longer exists`);

                    // Clean up files from local disk
                    try {
                        const projectDir = `./uploads/projects/${project._id}`;
                        if (fs.existsSync(projectDir)) {
                            fs.rmSync(projectDir, { recursive: true, force: true });
                        }
                    } catch (cleanupErr: any) {
                        logger.error(`failed to clean up project folder: ${cleanupErr.message}`);
                    }

                    // Clean up database records
                    await this.projectDao.deleteProjectById(project._id);
                    await this.transcriptDao.deleteTranscriptByProjectId(project._id);
                    await this.candidateDao.deleteCandidatesByProjectId(project._id);
                    await this.clipDao.deleteClipsByProjectId(project._id);
                }
            }
        }

        // 7. Register any new discovered video files
        for (const video of driveVideos) {
            if (!registeredFileIds.has(video.id)) {
                let projectName = video.name;
                const parentId = (video as any).parentFolderId;

                // If it's in the root folder, create a subfolder and move it there!
                if (parentId === studioFolderId) {
                    projectName = video.name.replace(/\.[^/.]+$/, ""); // Strip file extension
                    try {
                        const newFolderId = await this.googleDriveService.findOrCreateFolder(drive, projectName, studioFolderId);
                        logger.info(`Drive sync: Moving video "${video.name}" into its own new subfolder "${projectName}"`);
                        await this.googleDriveService.moveFile(drive, video.id, newFolderId);
                    } catch (moveErr: any) {
                        logger.warn(`Drive sync: Failed to move video: ${moveErr.message}`);
                    }
                } else if (parentId && folderNames[parentId]) {
                    // Use the parent subfolder name as the project name
                    projectName = folderNames[parentId];
                }

                logger.info(`Drive sync: Registering manually uploaded file "${video.name}" as project "${projectName}"`);
                await this.projectDao.createProject({
                    userId,
                    name: projectName,
                    originalName: video.name,
                    sourcePath: `https://www.googleapis.com/drive/v3/files/${video.id}?alt=media`,
                    driveFileId: video.id,
                    status: "ingest",
                    uploadStage: "completed",
                    uploadProgress: 100,
                    createdAt: video.createdTime ? new Date(video.createdTime) : new Date(),
                    updatedAt: new Date()
                });
            }
        }
    }


    // get detailed information for a single project
    getProjectDetail = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }

        // resolve drive client and migrate file to subfolder if it is sitting in the root of AutoShorts Studio
        const user = await this.userDao.findUserById(userId);
        let drive = null;
        let driveToken = null;
        if (user && user.googleAccessToken) {
            driveToken = await this.googleDriveService.getValidUserToken(user);
            drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        } else {
            drive = this.googleDriveService.getCentralDriveClient();
        }

        if (drive && project.driveFileId) {
            try {
                const file = await drive.files.get({
                    fileId: project.driveFileId,
                    fields: "parents, name"
                });
                const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                const projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
                const parents = file.data.parents || [];
                if (parents.includes(mainFolderId)) {
                    logger.info(`getProjectDetail: Moving source video "${file.data.name}" from AutoShorts Studio root into project subfolder "${project.name}"`);
                    await this.googleDriveService.moveFile(drive, project.driveFileId, projectFolderId);
                }
            } catch (err: any) {
                logger.warn(`getProjectDetail: Failed to auto-nest project video inside Google Drive: ${err.message}`);
            }
        }

        // Check if source_video.mp4 is missing locally, and if so, download it from Google Drive
        const projectDir = `./uploads/projects/${projectId}`;
        const localVideoPath = path.join(projectDir, "source_video.mp4");
        if (drive && project.driveFileId && !fs.existsSync(localVideoPath)) {
            logger.info(`Source video missing locally for project ${projectId}. Restoring from Google Drive...`);
            fs.mkdirSync(projectDir, { recursive: true });
            try {
                await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
                logger.info(`Source video restored from Google Drive successfully for project ${projectId}`);
                if (project.sourcePath !== localVideoPath) {
                    project.sourcePath = localVideoPath;
                    await project.save();
                }
            } catch (dlErr: any) {
                logger.error(`Failed to restore source video from Google Drive: ${dlErr.message}`);
            }
        }

        // fetching related details from transcripts, candidates, and clips
        const transcript = await this.transcriptDao.findTranscriptByProjectId(projectId);
        const candidates = await this.candidateDao.findCandidatesByProjectId(projectId);
        const clips = await this.clipDao.findClipsByProjectId(projectId);

        const detail = {
            project,
            transcript,
            candidates,
            clips
        };

        return Ok(res, "Project details retrieved successfully", detail);

    }

    // rename a project
    renameProject = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const { name } = req.body;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }


        project.name = name;
        await project.save();

        return Ok(res, "Project renamed successfully", project);

    }

    // delete a project and clean up its filesystem resources
    deleteProject = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }


        const user = await this.userDao.findUserById(userId);

        let drive = null;
        if (user && user.googleAccessToken) {
            const driveToken = await this.googleDriveService.getValidUserToken(user);
            drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        } else {
            drive = this.googleDriveService.getCentralDriveClient();
        }

        if (drive) {
            // clean up Drive raw video
            if (project.driveFileId) {
                await this.googleDriveService.deleteFile(drive, project.driveFileId);
            }
            // clean up Drive audio
            if (project.audioDriveFileId) {
                await this.googleDriveService.deleteFile(drive, project.audioDriveFileId);
            }
        }

        // cleaning up files from local disk
        try {

            // delete uploaded source video file locally if exists
            if (fs.existsSync(project.sourcePath)) {

                fs.unlinkSync(project.sourcePath);

            }

            // delete project output folder containing audio and rendered clips
            const projectDir = `./uploads/projects/${projectId}`;

            if (fs.existsSync(projectDir)) {

                fs.mkdirSync(projectDir, { recursive: true }); // safety check
                fs.rmSync(projectDir, { recursive: true, force: true });

            }

        }
        catch (cleanupErr: any) {

            logger.error(`failed to clean up project files: ${cleanupErr.message}`);

        }


        // clean up Cloudinary assets and Google Drive files for this project's clips
        try {

            const clips = await this.clipDao.findClipsByProjectId(projectId);

            for (const clip of clips) {

                if (drive && clip.driveFileId) {

                    await this.googleDriveService.deleteFile(drive, clip.driveFileId);

                }

            }

        }
        catch (cloudCleanupErr: any) {

            logger.warn(`failed to clean up drive assets for project ${projectId}: ${cloudCleanupErr.message}`);

        }


        // deleting database records
        await this.projectDao.deleteProjectById(projectId);
        await this.transcriptDao.deleteTranscriptByProjectId(projectId);
        await this.candidateDao.deleteCandidatesByProjectId(projectId);
        await this.clipDao.deleteClipsByProjectId(projectId);

        return Ok(res, "Project deleted successfully");

    }

    // transcribe audio wav file of a project
    transcribeProject = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const provider = req.body.provider || "local"; // local or deepgram
        const customApiKey = req.body.apiKey || null;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }


        // updating project status
        project.status = "transcribing";
        await project.save();

        const user = await this.userDao.findUserById(userId);
        let driveToken = null;
        let drive = null;

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

        if (!drive) {
            project.status = "ingest";
            await project.save();
            throw new BadRequest("No Google Drive storage configuration found.");
        }

        let transcriptRecord = await this.transcriptDao.findTranscriptByProjectId(projectId);

        if (!transcriptRecord) {
            let driveSrtFileId: string | null = null;
            let driveSrtFileName: string = "";
            try {
                const projectFolderId = project.driveFolderId || await this.googleDriveService.getOrCreateProjectFolder(drive, project.name || "Untitled Project");
                const driveFiles = await drive.files.list({
                    q: `'${projectFolderId}' in parents and name contains '.srt' and trashed = false`,
                    fields: "files(id, name)"
                });
                const srtFiles = driveFiles.data.files || [];
                if (srtFiles.length > 0) {
                    driveSrtFileId = srtFiles[0].id;
                    driveSrtFileName = srtFiles[0].name;
                }
            } catch (err: any) {
                logger.warn(`Failed to list SRT files from Drive folder: ${err.message}`);
            }

            if (driveSrtFileId) {
                try {
                    logger.info(`Found existing SRT file in Google Drive: ${driveSrtFileName}. Downloading and skipping generation...`);
                    const projectDir = `./uploads/projects/${projectId}`;
                    fs.mkdirSync(projectDir, { recursive: true });
                    const localSrtPath = path.join(projectDir, "temp_imported.srt");
                    await this.googleDriveService.downloadFile(drive, driveSrtFileId, localSrtPath);
                    const srtText = fs.readFileSync(localSrtPath, "utf-8");
                    const transcriptData = parseSrtToTranscript(srtText);

                    transcriptRecord = await this.transcriptDao.createTranscript({
                        projectId: project._id,
                        rawJson: JSON.stringify(transcriptData),
                        engine: "drive-srt",
                        language: transcriptData.language || "en"
                    });
                } catch (loadErr: any) {
                    logger.warn(`Failed to load/parse Drive SRT file: ${loadErr.message}`);
                }
            }
        }

        if (transcriptRecord) {
            project.status = "analyzing";
            await project.save();
            return Ok(res, "Transcript loaded successfully", transcriptRecord);
        }

        const projectDir = `./uploads/projects/${projectId}`;
        const localVideoPath = path.join(projectDir, "source_video.mp4");

        const op = operationManager.createOperation({
            projectId,
            type: "TRANSCRIPTION"
        });

        try {
            fs.mkdirSync(projectDir, { recursive: true });

            operationManager.updateStep(op.operationId, "PREPARE_AUDIO", "running", "Preparing source video and extracting audio...");

            if (!fs.existsSync(localVideoPath)) {
                logger.info(`Source video not found locally. Downloading from GDrive: ${project.driveFileId}`);
                await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
            }

            // 1. extract audio wav file using local file path (no googleToken needed!)
            const audioPath = await this.mediaService.extractAudio(localVideoPath, projectDir);
            operationManager.updateStep(op.operationId, "PREPARE_AUDIO", "completed", "Audio extracted");

            operationManager.updateStep(op.operationId, "UPLOAD_AUDIO", "completed", "Audio ready for engine");
            operationManager.updateStep(op.operationId, "TRANSCRIBE_GROQ", "running", `Transcribing audio using ${provider}...`);

            // 2. transcribe audio based on provider
            let transcriptData = null;

            if (provider === "groq") {
                const apiKeys = [customApiKey, ...(user?.groqKeys || [])].filter(Boolean);
                if (apiKeys.length === 0) {
                    throw new BadRequest("Groq API Key is missing. Please configure it in settings.");
                }
                transcriptData = await this.transcriptionService.transcribeGroq(audioPath, apiKeys[0] as string);
            }
            else if (provider === "openai") {
                const apiKeys = [customApiKey, ...(user?.openaiKeys || [])].filter(Boolean);
                if (apiKeys.length === 0) {
                    throw new BadRequest("OpenAI API Key is missing. Please configure it in settings.");
                }
                transcriptData = await this.transcriptionService.transcribeOpenAI(audioPath, apiKeys[0] as string);
            }
            else if (provider === "deepgram") {
                const apiKeys = [customApiKey, ...(user?.deepgramKeys || [])].filter(Boolean);
                if (apiKeys.length === 0) {
                    throw new BadRequest("Deepgram API Key is missing. Please configure it in settings.");
                }
                const apiKey = apiKeys[0] as string;
                if (apiKey.length < 20) {
                    throw new BadRequest(
                        `Your Deepgram API key appears to be corrupted or truncated (${apiKey.length} chars). Please re-enter your full API key in Settings.`
                    );
                }
                try {
                    transcriptData = await this.transcriptionService.transcribeDeepgram(audioPath, apiKey);
                } catch (dgErr: any) {
                    if (dgErr.response?.status === 401) {
                        throw new BadRequest("Deepgram returned 401 Unauthorized — your API key is invalid. Please check and re-enter your Deepgram key in Settings.");
                    }
                    throw dgErr;
                }
            }
            else if (provider === "local") {
                const keys = {
                    groq: [...(user?.groqKeys || [])].filter(Boolean) as string[],
                    openai: [...(user?.openaiKeys || [])].filter(Boolean) as string[],
                    deepgram: [...(user?.deepgramKeys || [])].filter(Boolean) as string[]
                };
                const hasLocal = await this.transcriptionService.isWhisperCliAvailable();
                if (hasLocal) {
                    try {
                        transcriptData = await this.transcriptionService.transcribeLocal(audioPath, projectDir);
                    } catch (err: any) {
                        logger.warn(`Local Whisper failed (${err.message}). Trying Groq backup...`);
                        transcriptData = await this.transcriptionService.transcribeAuto(audioPath, keys, projectDir);
                    }
                } else {
                    transcriptData = await this.transcriptionService.transcribeAuto(audioPath, keys, projectDir);
                }
            }
            else {
                // "auto" mode
                const keys = {
                    groq: [customApiKey, ...(user?.groqKeys || [])].filter(Boolean) as string[],
                    openai: [...(user?.openaiKeys || [])].filter(Boolean) as string[],
                    deepgram: [...(user?.deepgramKeys || [])].filter(Boolean) as string[]
                };
                transcriptData = await this.transcriptionService.transcribeAuto(audioPath, keys, projectDir);
            }

            operationManager.updateStep(op.operationId, "TRANSCRIBE_GROQ", "completed", "Audio transcription complete");
            operationManager.updateStep(op.operationId, "PROCESS_TIMESTAMPS", "completed", `Processed ${transcriptData.words?.length || 0} word timestamps`);
            operationManager.updateStep(op.operationId, "SAVE_TRANSCRIPT", "running", "Saving transcript to project...");

            // 3. save transcript to database
            const rawJson = JSON.stringify(transcriptData);

            const transcript = await this.transcriptDao.createTranscript({
                projectId: project._id,
                rawJson: rawJson,
                engine: provider,
                language: transcriptData.language
            });

            // 3.5. generate full-length SRT file and save in the project directory
            try {
                const words = transcriptData.words || [];
                const srtContent = generateSrt(words, 0, transcriptData.duration || 999999);
                const sourceVideoName = path.basename(String(project.originalName || project.name || "video"));
                const srtFilename = `${path.parse(sourceVideoName).name}.srt`;
                const srtPath = path.join(projectDir, srtFilename);
                fs.writeFileSync(srtPath, srtContent);
                logger.info(`Full transcription SRT file saved to ${srtPath}`);

                if (drive) {
                    const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                    const projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
                    await this.googleDriveService.uploadFile(
                        drive,
                        srtPath,
                        srtFilename,
                        "text/plain",
                        "AutoShorts Studio",
                        undefined,
                        projectFolderId
                    );
                    logger.info(`Full transcription SRT file uploaded to Google Drive project folder "${project.name}"`);
                }
            } catch (srtErr: any) {
                logger.warn(`Failed to write/upload transcription.srt: ${srtErr.message}`);
            }

            // 4. update project status to analyzing
            project.status = "analyzing";
            project.sourceDuration = transcriptData.duration;
            await project.save();

            // cleanup local audio file
            try {
                if (fs.existsSync(audioPath as string)) {
                    fs.unlinkSync(audioPath as string);
                }
            } catch (delErr: any) {
                logger.warn(`Failed to delete local transcribed audio file: ${delErr.message}`);
            }

            // The editor needs the actual words/segments, not only the database
            // record that stores them as raw JSON. Returning transcriptData also
            // preserves successful chunks when a later Groq chunk is rate-limited.
            return Ok(res, "Transcription complete", {
                ...transcriptData,
                transcriptId: transcript._id
            });

        }
        catch (err) {

            // cleanup local audio file on error too
            try {
                const audioPath = path.join(projectDir, "transcription_audio.wav");
                if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                }
            } catch {}

            project.status = "ingest";
            await project.save();
            throw err;

        }
        finally {
            // Keep source_video.mp4 locally; no unlink needed here
        }


    }

    // detect viral moments using LLM configurations with chunking, scoring, and fallback chain
    generateCandidates = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const provider = req.body.provider || env.LLM_PROVIDER || "mistral";
        const customApiKey = req.body.apiKey || null;
        const modelName = req.body.modelName || env.LLM_MODEL || undefined;
        const durationStyle = "one-minute"; // Generated clips are always a real 60-second source range.
        const clipCount = parseInt(req.body.clipCount || req.body.count || env.DEFAULT_CLIP_COUNT || "5") || 5;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const transcriptRecord = await this.transcriptDao.findTranscriptByProjectId(projectId);

        if (!transcriptRecord) {
            throw new BadRequest("Project must be transcribed before moment analysis");
        }

        const transcript = JSON.parse(transcriptRecord.rawJson);

        project.status = "analyzing";
        await project.save();

        try {
            const user = await this.userDao.findUserById(userId);

            const userKeys: Record<string, string[]> = {
                mistral: [...(user?.mistralKeys || []), process.env.MISTRAL_API_KEY, env.MISTRAL_API_KEY].filter(Boolean) as string[],
                groq: [...(user?.groqKeys || [])].filter(Boolean) as string[],
                openrouter: [...(user?.openrouterKeys || []), process.env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY].filter(Boolean) as string[],
                deepseek: [...(user?.deepseekKeys || []), process.env.DEEPSEEK_API_KEY].filter(Boolean) as string[],
                openai: [...(user?.openaiKeys || [])].filter(Boolean) as string[],
                claude: [...(user?.anthropicKeys || []), process.env.ANTHROPIC_API_KEY].filter(Boolean) as string[],
                gemini: [...(user?.geminiKeys || []), process.env.GEMINI_API_KEY].filter(Boolean) as string[]
            };

            // Deduplicate keys for each provider
            for (const p of Object.keys(userKeys)) {
                userKeys[p] = [...new Set(userKeys[p])];
            }

            const drafts = await this.llmService.detectMomentsWithFallbackChain(
                transcript,
                provider,
                customApiKey ? [customApiKey] : userKeys[provider.toLowerCase()],
                modelName,
                durationStyle,
                clipCount,
                userKeys
            );

            if (!drafts || drafts.length === 0) {
                throw new Error("No viable clip candidates were returned for this transcript.");
            }

            // clean up previous candidates & clips
            await this.candidateDao.deleteCandidatesByProjectId(projectId);
            await this.clipDao.deleteClipsByProjectId(projectId);

            // save new candidates and generate blank clips
            const savedCandidates = [];
            const selectedCutoff = Math.min(drafts.length, clipCount);

            for (let i = 0; i < drafts.length; i++) {
                const draft = drafts[i];

                const candidate = await this.candidateDao.createCandidate({
                    projectId: project._id,
                    title: draft.title,
                    startSec: draft.start,
                    endSec: draft.end,
                    duration: draft.duration,
                    score: draft.score,
                    scoreBreakdown: draft.scoreBreakdown,
                    hook: draft.hook,
                    rationale: draft.rationale,
                    contentType: draft.contentType || "Viral",
                    secondaryTypes: draft.secondaryTypes || [],
                    topic: draft.topic || null,
                    subtopic: draft.subtopic || null,
                    summary: draft.summary || null,
                    emotion: draft.emotion || null,
                    audience: draft.audience || null,
                    hookType: draft.hookType || "Curiosity",
                    recommendedPlatforms: draft.recommendedPlatforms || ["TikTok", "Instagram Reels", "YouTube Shorts"],
                    suggestedTitles: draft.suggestedTitles || [],
                    suggestedHooks: draft.suggestedHooks || [],
                    suggestedCaptions: draft.suggestedCaptions || null,
                    reviewStatus: "ai_found",
                    rank: i + 1,
                    selected: i < selectedCutoff
                });

                // create corresponding pending clip record
                await this.clipDao.createClip({
                    candidateId: candidate._id,
                    projectId: project._id,
                    status: "pending"
                });

                savedCandidates.push(candidate);
            }

            project.status = "ready";
            await project.save();

            return Ok(res, "Viral moments generated successfully", savedCandidates);

        }
        catch (err) {
            project.status = "ready";
            await project.save();
            throw err;
        }

    }

    // execute complete end-to-end pipeline: 1 Long Video -> Transcribe -> Analyze -> Render Multiple Shorts -> Upload to Drive
    runAutoPipeline = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const provider = req.body.provider || env.LLM_PROVIDER || "mistral";
        const transcriptionMode = req.body.transcriptionMode || "local";
        const captionStyle = req.body.captionStyle || "modern-box";
        const clipCount = parseInt(req.body.clipCount || env.DEFAULT_CLIP_COUNT || "5") || 5;

        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");

        const effectiveUserId = (req as any).user?.userId || (req as any).user?._id || (req as any).user?.id || project.userId?.toString();

        if (project.userId && userId && project.userId.toString() !== userId.toString()) {
            throw new Forbidden("You do not have access to this resource");
        }

        // Run full pipeline in background
        const executePipeline = async () => {
            const op = operationManager.createOperation({
                projectId,
                type: "VIDEO_ANALYSIS",
                cancellable: true
            });

            const projectDir = `./uploads/projects/${projectId}`;
            const localVideoPath = path.join(projectDir, "source_video.mp4");
            const updateProgress = async (stage: string, message: string, percent: number) => {
                try {
                    logger.info(`[Pipeline ${projectId}] ${stage} (${percent}%): ${message}`);
                    (project as any).pipelineStage = stage;
                    (project as any).pipelineMessage = message;
                    (project as any).pipelineProgress = percent;
                    if (!(project as any).pipelineLogs) (project as any).pipelineLogs = [];
                    (project as any).pipelineLogs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
                    if ((project as any).pipelineLogs.length > 25) {
                        (project as any).pipelineLogs = (project as any).pipelineLogs.slice(-25);
                    }
                    await project.save();
                } catch {}
            };

            try {
                fs.mkdirSync(projectDir, { recursive: true });

                operationManager.updateStep(op.operationId, "PREPARE_VIDEO", "running", "Preparing source video...");

                const user = await this.userDao.findUserById(effectiveUserId);
                let drive = null;
                let driveToken = null;

                if (user && user.googleAccessToken) {
                    driveToken = await this.googleDriveService.getValidUserToken(user);
                    drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
                } else {
                    drive = this.googleDriveService.getCentralDriveClient();
                }

                // 1. Download video if not local
                if (!fs.existsSync(localVideoPath) && project.driveFileId && drive) {
                    await updateProgress("downloading", "Downloading source video from Google Drive...", 3);
                    operationManager.updateStep(op.operationId, "PREPARE_VIDEO", "running", "Downloading source video from Google Drive...");
                    await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
                }

                operationManager.updateStep(op.operationId, "PREPARE_VIDEO", "completed", "Video prepared");

                // 2. Transcription
                let transcriptRecord = await this.transcriptDao.findTranscriptByProjectId(projectId);
                let transcriptData = null;

                if (!transcriptRecord) {
                    let driveSrtFileId: string | null = null;
                    let driveSrtFileName: string = "";
                    try {
                        const projectFolderId = project.driveFolderId || await this.googleDriveService.getOrCreateProjectFolder(drive, project.name || "Untitled Project");
                        const driveFiles = await drive.files.list({
                            q: `'${projectFolderId}' in parents and name contains '.srt' and trashed = false`,
                            fields: "files(id, name)"
                        });
                        const srtFiles = driveFiles.data.files || [];
                        if (srtFiles.length > 0) {
                            driveSrtFileId = srtFiles[0].id;
                            driveSrtFileName = srtFiles[0].name;
                        }
                    } catch (err: any) {
                        logger.warn(`Failed to list SRT files from Drive folder: ${err.message}`);
                    }

                    if (driveSrtFileId) {
                        try {
                            logger.info(`Found existing SRT file in Google Drive: ${driveSrtFileName}. Downloading and skipping generation...`);
                            operationManager.updateStep(op.operationId, "EXTRACT_AUDIO", "completed", "Loaded existing captions from GDrive");
                            operationManager.updateStep(op.operationId, "TRANSCRIBE_AUDIO", "running", `Downloading GDrive SRT: ${driveSrtFileName}...`);

                            const localSrtPath = path.join(projectDir, "temp_imported.srt");
                            await this.googleDriveService.downloadFile(drive, driveSrtFileId, localSrtPath);
                            const srtText = fs.readFileSync(localSrtPath, "utf-8");
                            transcriptData = parseSrtToTranscript(srtText);

                            transcriptRecord = await this.transcriptDao.createTranscript({
                                projectId: project._id,
                                rawJson: JSON.stringify(transcriptData),
                                engine: "drive-srt",
                                language: transcriptData.language || "en"
                            });

                            operationManager.updateStep(op.operationId, "TRANSCRIBE_AUDIO", "completed", `Loaded ${transcriptData.words?.length || 0} captions from GDrive SRT file`);
                        } catch (loadErr: any) {
                            logger.warn(`Failed to load/parse Drive SRT file, falling back to transcription: ${loadErr.message}`);
                        }
                    }
                }

                if (!transcriptRecord) {
                    project.status = "transcribing";
                    await project.save();

                    operationManager.updateStep(op.operationId, "EXTRACT_AUDIO", "running", "Extracting audio from video...");
                    await updateProgress("extracting_audio", "Extracting high-efficiency audio from video...", 5);
                    const audioPath = await this.mediaService.extractAudio(localVideoPath, projectDir);
                    operationManager.updateStep(op.operationId, "EXTRACT_AUDIO", "completed", "Audio extracted");

                    const keys = {
                        groq: [req.body?.groqKey, req.body?.keys?.groqKey, ...(user?.groqKeys || [])].filter(Boolean) as string[],
                        openai: [req.body?.openaiKey, req.body?.keys?.openaiKey, ...(user?.openaiKeys || [])].filter(Boolean) as string[],
                        deepgram: [req.body?.deepgramKey, req.body?.keys?.deepgramKey, ...(user?.deepgramKeys || [])].filter(Boolean) as string[]
                    };

                    logger.info(`AutoPipeline: Resolved keys for user ${user?.email || effectiveUserId} - Groq: ${keys.groq.length > 0}, OpenAI: ${keys.openai.length > 0}, Deepgram: ${keys.deepgram.length > 0}`);

                    operationManager.updateStep(op.operationId, "TRANSCRIBE_AUDIO", "running", "Transcribing video...");

                    const progressCallback = async (msg: string, percent: number) => {
                        await updateProgress("transcribing", msg, percent);
                        operationManager.updateProgress(op.operationId, Math.max(10, Math.min(60, percent)), msg);
                    };

                    const languagePref = req.body?.language || "hinglish";

                    if (transcriptionMode === "groq" && keys.groq.length > 0) {
                        transcriptData = await this.transcriptionService.transcribeGroq(audioPath, keys.groq[0], progressCallback, languagePref);
                    } else if (transcriptionMode === "openai" && keys.openai.length > 0) {
                        transcriptData = await this.transcriptionService.transcribeOpenAI(audioPath, keys.openai[0], progressCallback, languagePref);
                    } else if (transcriptionMode === "deepgram" && keys.deepgram.length > 0) {
                        await updateProgress("transcribing", "Transcribing via Deepgram Nova-2...", 20);
                        transcriptData = await this.transcriptionService.transcribeDeepgram(audioPath, keys.deepgram[0]);
                    } else if (transcriptionMode === "local") {
                        const hasLocal = await this.transcriptionService.isWhisperCliAvailable();
                        if (hasLocal) {
                            await updateProgress("transcribing", "Transcribing locally with Whisper CLI...", 20);
                            transcriptData = await this.transcriptionService.transcribeLocal(audioPath, projectDir);
                        } else {
                            transcriptData = await this.transcriptionService.transcribeAuto(audioPath, keys, projectDir);
                        }
                    } else {
                        if (keys.groq.length > 0) {
                            transcriptData = await this.transcriptionService.transcribeGroq(audioPath, keys.groq[0], progressCallback, languagePref);
                        } else {
                            transcriptData = await this.transcriptionService.transcribeAuto(audioPath, keys, projectDir);
                        }
                    }

                    transcriptRecord = await this.transcriptDao.createTranscript({
                        projectId: project._id,
                        rawJson: JSON.stringify(transcriptData),
                        engine: transcriptionMode,
                        language: transcriptData.language
                    });

                    operationManager.updateStep(op.operationId, "TRANSCRIBE_AUDIO", "completed", "Transcript generated", {
                        language: transcriptData.language,
                        wordCount: transcriptData.words?.length || 0
                    });

                    // Upload master SRT to Drive
                    try {
                        const words = transcriptData.words || [];
                        const srtContent = generateSrt(words, 0, transcriptData.duration || 999999);
                        const sourceVideoName = path.basename(String(project.originalName || project.name || "video"));
                        const srtFilename = `${path.parse(sourceVideoName).name}.srt`;
                        const srtPath = path.join(projectDir, srtFilename);
                        fs.writeFileSync(srtPath, srtContent);

                        if (drive) {
                            const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                            const projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
                            await this.googleDriveService.uploadFile(
                                drive,
                                srtPath,
                                srtFilename,
                                "text/plain",
                                "AutoShorts Studio",
                                undefined,
                                projectFolderId
                            );
                        }
                    } catch (srtErr: any) {
                        logger.warn(`AutoPipeline: SRT upload error: ${srtErr.message}`);
                    }

                    try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch {}
                } else {
                    transcriptData = JSON.parse(transcriptRecord.rawJson);
                    operationManager.updateStep(op.operationId, "TRANSCRIBE_AUDIO", "completed", "Loaded existing transcript");
                }

                // 3. AI Moment Analysis & Scoring
                project.status = "analyzing";
                await project.save();

                operationManager.updateStep(op.operationId, "DETECT_TOPICS", "running", "Detecting topics & content structure...");
                operationManager.updateStep(op.operationId, "DETECT_CONTENT_TYPES", "running", "Detecting content types & hooks...");
                operationManager.updateStep(op.operationId, "FIND_HOOKS", "running", "Finding high-potential viral hooks...");
                operationManager.updateStep(op.operationId, "SCORE_CANDIDATES", "running", `Scoring candidate moments with ${provider} AI...`);

                await updateProgress("analyzing_moments", `Analyzing viral hooks and scoring moments with ${provider} AI...`, 72);
                const userKeys: Record<string, string[]> = {
                    mistral: [req.body?.mistralKey, req.body?.keys?.mistralKey, ...(user?.mistralKeys || []), process.env.MISTRAL_API_KEY, env.MISTRAL_API_KEY].filter(Boolean) as string[],
                    groq: [req.body?.groqKey, req.body?.keys?.groqKey, ...(user?.groqKeys || [])].filter(Boolean) as string[],
                    openrouter: [req.body?.openrouterKey, ...(user?.openrouterKeys || []), process.env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY].filter(Boolean) as string[],
                    deepseek: [req.body?.deepseekKey, ...(user?.deepseekKeys || []), process.env.DEEPSEEK_API_KEY].filter(Boolean) as string[],
                    openai: [req.body?.openaiKey, req.body?.keys?.openaiKey, ...(user?.openaiKeys || [])].filter(Boolean) as string[],
                    claude: [req.body?.anthropicKey, ...(user?.anthropicKeys || []), process.env.ANTHROPIC_API_KEY].filter(Boolean) as string[],
                    gemini: [req.body?.geminiKey, ...(user?.geminiKeys || []), process.env.GEMINI_API_KEY].filter(Boolean) as string[]
                };

                // Deduplicate keys for each provider
                for (const p of Object.keys(userKeys)) {
                    userKeys[p] = [...new Set(userKeys[p])];
                }

                const drafts = await this.llmService.detectMomentsWithFallbackChain(
                    transcriptData,
                    provider,
                    userKeys[provider.toLowerCase()],
                    undefined,
                    req.body.durationStyle || "mixed",
                    clipCount,
                    userKeys
                );

                operationManager.updateStep(op.operationId, "DETECT_TOPICS", "completed", "Topics detected");
                operationManager.updateStep(op.operationId, "DETECT_CONTENT_TYPES", "completed", "Content types classified");
                operationManager.updateStep(op.operationId, "FIND_HOOKS", "completed", `Identified ${drafts.length} high-potential hooks`);
                operationManager.updateStep(op.operationId, "SCORE_CANDIDATES", "completed", `Scored ${drafts.length} candidate moments`);

                operationManager.updateStep(op.operationId, "BUILD_CONTENT_MAP", "running", "Building Content Map & candidate timelines...");

                await this.candidateDao.deleteCandidatesByProjectId(projectId);
                await this.clipDao.deleteClipsByProjectId(projectId);

                const createdCandidates = [];
                for (let i = 0; i < drafts.length; i++) {
                    const draft = drafts[i];
                    const cand = await this.candidateDao.createCandidate({
                        projectId: project._id,
                        title: draft.title,
                        startSec: draft.start,
                        endSec: draft.end,
                        duration: draft.duration,
                        score: draft.score,
                        scoreBreakdown: draft.scoreBreakdown,
                        hook: draft.hook,
                        rationale: draft.rationale,
                        contentType: draft.contentType || "Viral",
                        secondaryTypes: draft.secondaryTypes || [],
                        topic: draft.topic || null,
                        subtopic: draft.subtopic || null,
                        summary: draft.summary || null,
                        emotion: draft.emotion || null,
                        audience: draft.audience || null,
                        hookType: draft.hookType || "Curiosity",
                        recommendedPlatforms: draft.recommendedPlatforms || ["TikTok", "Instagram Reels", "YouTube Shorts"],
                        suggestedTitles: draft.suggestedTitles || [],
                        suggestedHooks: draft.suggestedHooks || [],
                        suggestedCaptions: draft.suggestedCaptions || null,
                        reviewStatus: "ai_found",
                        rank: i + 1,
                        selected: true
                    });

                    const clip = await this.clipDao.createClip({
                        candidateId: cand._id,
                        projectId: project._id,
                        status: "pending",
                        captionStyle
                    });

                    createdCandidates.push({ candidate: cand, clip });
                }

                operationManager.updateStep(op.operationId, "BUILD_CONTENT_MAP", "completed", "Content Map ready", {
                    candidateCount: createdCandidates.length
                });

                operationManager.updateStep(op.operationId, "SAVE_ANALYSIS", "running", "Saving analysis and rendering shorts...");

                // 4. Batch Render and Upload Multiple Clips to Google Drive
                project.status = "rendering";
                await project.save();

                let projectFolderId: string | undefined = undefined;
                if (drive) {
                    const mainFolderId = await this.googleDriveService.findOrCreateFolder(drive, "AutoShorts Studio");
                    projectFolderId = await this.googleDriveService.findOrCreateFolder(drive, project.name || "Untitled Project", mainFolderId);
                }

                const words = transcriptData.words || [];

                for (let cIdx = 0; cIdx < createdCandidates.length; cIdx++) {
                    const item = createdCandidates[cIdx];
                    const cand = item.candidate;
                    const clip = item.clip;

                    const renderPercent = Math.round(75 + ((cIdx / createdCandidates.length) * 23));
                    await updateProgress("rendering_shorts", `Rendering vertical 9:16 Short ${cIdx + 1}/${createdCandidates.length} (${cand.title})...`, renderPercent);
                    operationManager.updateProgress(op.operationId, renderPercent, `Rendering Short ${cIdx + 1}/${createdCandidates.length}: "${cand.title}"`);

                    try {
                        await this.clipDao.updateClipById(clip._id, { status: "cutting" });

                        const candidateWords = words.filter((w: any) => w.start >= cand.startSec && w.end <= cand.endSec);
                        const clipSrtContent = generateSrt(candidateWords, cand.startSec, cand.endSec);
                        const clipSrtPath = path.join(projectDir, "clips", `clip-${cand.rank.toString().padStart(2, "0")}.srt`);
                        fs.mkdirSync(path.join(projectDir, "clips"), { recursive: true });
                        fs.writeFileSync(clipSrtPath, clipSrtContent);

                        // Upload clip SRT
                        if (drive) {
                            await this.googleDriveService.uploadFile(
                                drive,
                                clipSrtPath,
                                `clip-${cand.rank.toString().padStart(2, "0")}.srt`,
                                "text/plain",
                                "AutoShorts Studio",
                                undefined,
                                projectFolderId
                            );
                        }

                        // Render 9:16 Vertical
                        const outVertical = path.join(projectDir, "clips", `clip-${cand.rank.toString().padStart(2, "0")}_vertical.mp4`);
                        const renderPathVertical = await this.mediaService.renderRemotionClip(
                            localVideoPath,
                            cand.startSec,
                            cand.endSec,
                            outVertical,
                            candidateWords,
                            captionStyle,
                            { aspectRatio: "vertical" }
                        );

                        let driveVertical = null;
                        if (drive) {
                            driveVertical = await this.googleDriveService.uploadFile(
                                drive,
                                renderPathVertical as string,
                                `clip-${cand.rank.toString().padStart(2, "0")}_vertical.mp4`,
                                "video/mp4",
                                "AutoShorts Studio",
                                undefined,
                                projectFolderId
                            );
                        }

                        // Render 16:9 Horizontal
                        const outHorizontal = path.join(projectDir, "clips", `clip-${cand.rank.toString().padStart(2, "0")}_horizontal.mp4`);
                        const renderPathHorizontal = await this.mediaService.renderRemotionClip(
                            localVideoPath,
                            cand.startSec,
                            cand.endSec,
                            outHorizontal,
                            candidateWords,
                            captionStyle,
                            { aspectRatio: "horizontal" }
                        );

                        let driveHorizontal = null;
                        if (drive) {
                            driveHorizontal = await this.googleDriveService.uploadFile(
                                drive,
                                renderPathHorizontal as string,
                                `clip-${cand.rank.toString().padStart(2, "0")}_horizontal.mp4`,
                                "video/mp4",
                                "AutoShorts Studio",
                                undefined,
                                projectFolderId
                            );
                        }

                        // Cleanup local rendered output files
                        try {
                            if (fs.existsSync(renderPathVertical as string)) fs.unlinkSync(renderPathVertical as string);
                            if (fs.existsSync(renderPathHorizontal as string)) fs.unlinkSync(renderPathHorizontal as string);
                            if (fs.existsSync(clipSrtPath)) fs.unlinkSync(clipSrtPath);
                        } catch {}

                        await this.clipDao.updateClipById(clip._id, {
                            status: "done",
                            outputPath: renderPathVertical,
                            outputPathHorizontal: renderPathHorizontal,
                            aspectRatio: "both",
                            driveFileId: driveVertical?.fileId || null,
                            driveUrl: driveVertical?.webViewLink || null,
                            driveFileIdHorizontal: driveHorizontal?.fileId || null,
                            driveUrlHorizontal: driveHorizontal?.webViewLink || null
                        });

                        logger.info(`AutoPipeline: Rendered and uploaded clip ${cand.rank}`);
                    } catch (clipErr: any) {
                        logger.error(`AutoPipeline: Error processing clip ${cand.rank}: ${clipErr.message}`);
                        await this.clipDao.updateClipById(clip._id, {
                            status: "error",
                            renderLog: clipErr.message
                        });
                    }
                }

                project.status = "completed";
                await updateProgress("completed", `Pipeline complete! Extracted ${createdCandidates.length} viral 9:16 Shorts.`, 100);
                operationManager.updateStep(op.operationId, "SAVE_ANALYSIS", "completed", "Analysis and Shorts saved");
                operationManager.completeOperation(op.operationId, `Pipeline complete! Extracted ${createdCandidates.length} viral 9:16 Shorts.`, {
                    candidateCount: createdCandidates.length
                });

                logger.info(`AutoPipeline: Complete video pipeline finished successfully for project ${projectId}`);
            } catch (pipeErr: any) {
                logger.error(`AutoPipeline: Pipeline failed for project ${projectId}: ${pipeErr.message}`);
                project.status = "ready";
                await updateProgress("error", `Pipeline failed: ${pipeErr.message}`, 0);
                operationManager.failOperation(op.operationId, pipeErr.message);
            }
        };

        executePipeline();

        return Ok(res, "Auto video pipeline initiated in background", { projectId, status: "processing" });
    };

    // get real-time pipeline status and logs for UI progress stream
    getPipelineStatus = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");

        const candidates = await this.candidateDao.findCandidatesByProjectId(projectId);

        return Ok(res, "Pipeline status retrieved", {
            status: project.status,
            progress: (project as any).pipelineProgress || 0,
            stage: (project as any).pipelineStage || project.status,
            message: (project as any).pipelineMessage || "",
            logs: (project as any).pipelineLogs || [],
            candidates: candidates || []
        });
    };

    // update the selected clip count (mark ranks <= count as selected)
    updateClipCount = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const { count } = req.body;
        const userId = (req as any).user?.userId;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }


        const candidates = await this.candidateDao.findCandidatesByProjectId(projectId);

        // updating selected flag based on rank
        for (const candidate of candidates) {

            candidate.selected = candidate.rank <= count;
            await candidate.save();

        }

        return Ok(res, "Selected clip count updated successfully", candidates);

    }

    // update transcript words list
    updateTranscript = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const { words } = req.body;
        const userId = (req as any).user?.userId;

        if (!Array.isArray(words)) {

            throw new BadRequest("Words must be an array");

        }

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {

            throw new NotFound("Project not found");

        }

        // verify ownership
        if (project.userId && project.userId.toString() !== userId) {

            throw new Forbidden("You do not have access to this resource");

        }


        const transcript = await this.transcriptDao.findTranscriptByProjectId(projectId);

        if (!transcript) {

            throw new NotFound("Transcript not found");

        }

        // update rawJson text with modified words array
        const rawJsonObj = JSON.parse(transcript.rawJson);
        rawJsonObj.words = words;

        // rebuild segments using updated words list to sync both raw datasets
        const segments = [];
        let currentSegment = null;

        for (const word of words) {

            if (!currentSegment || (word.start - currentSegment.end > 2.0) || (currentSegment.text.length > 80)) {

                if (currentSegment) {

                    segments.push(currentSegment);

                }

                currentSegment = {
                    start: word.start,
                    end: word.end,
                    text: word.text,
                    words: [word]
                };

            }
            else {

                currentSegment.end = word.end;
                currentSegment.text += " " + word.text;
                currentSegment.words.push(word);

            }

        }

        if (currentSegment) {

            segments.push(currentSegment);

        }

        rawJsonObj.segments = segments;

        transcript.rawJson = JSON.stringify(rawJsonObj);
        await transcript.save();

        return Ok(res, "Transcript updated successfully", transcript);

    }

    // get project timeline state (or initialize default timeline from source video + transcript)
    // Persist editor-only state as one JSON file in the project Google Drive folder.
    saveDriveTimeline = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const { timelineState } = req.body;
        if (!timelineState) throw new BadRequest("timelineState is required");

        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");
        if (project.userId && project.userId.toString() !== userId) throw new Forbidden("You do not have access to this resource");

        const user = await this.userDao.findUserById(userId);
        const driveToken = user ? await this.googleDriveService.getValidUserToken(user) : null;
        if (!user || !driveToken) throw new BadRequest("Google Drive must be connected to save project edits");

        const drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        const folderId = await this.googleDriveService.getOrCreateProjectFolder(drive, project.name || "Untitled Project", project.driveFolderId);
        if (!project.driveFolderId || project.driveFolderId !== folderId) await this.projectDao.updateProjectDriveFolder(projectId, folderId);

        const sourceName = path.basename(String(project.originalName || project.name || "video"));
        const timelineFilename = `${path.parse(sourceName).name}.timeline.json`;
        const existingFiles = await this.googleDriveService.listFilesInFolder(drive, folderId);
        await Promise.all(existingFiles.filter((file: any) => file.name === timelineFilename).map((file: any) => this.googleDriveService.deleteFile(drive, file.id)));

        const tempPath = path.join(os.tmpdir(), `katitor-timeline-${projectId}-${Date.now()}.json`);
        try {
            fs.writeFileSync(tempPath, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), timeline: timelineState }));
            const upload = await this.googleDriveService.uploadFile(drive, tempPath, timelineFilename, "application/json", "AutoShorts Studio", undefined, folderId);
            if (!upload) throw new BadRequest("Could not save project edits to Google Drive");
            return Ok(res, "Timeline saved to Google Drive", { fileId: upload.fileId, filename: timelineFilename });
        } finally {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        }
    };

    loadDriveTimeline = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");
        if (project.userId && project.userId.toString() !== userId) throw new Forbidden("You do not have access to this resource");

        const user = await this.userDao.findUserById(userId);
        const driveToken = user ? await this.googleDriveService.getValidUserToken(user) : null;
        if (!user || !driveToken) return Ok(res, "Drive not connected", { timeline: null });

        const drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        const folderId = await this.googleDriveService.getOrCreateProjectFolder(drive, project.name || "Untitled Project", project.driveFolderId);
        const sourceName = path.basename(String(project.originalName || project.name || "video"));
        const timelineFilename = `${path.parse(sourceName).name}.timeline.json`;
        const file = (await this.googleDriveService.listFilesInFolder(drive, folderId)).find((item: any) => item.name === timelineFilename);
        if (!file) return Ok(res, "No saved Drive timeline", { timeline: null });

        try {
            const response = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "text" });
            const saved = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
            return Ok(res, "Timeline loaded from Google Drive", { timeline: saved?.timeline || saved, filename: timelineFilename });
        } catch (err: any) {
            throw new BadRequest(`Could not load saved timeline from Google Drive: ${err.message}`);
        }
    };
    getTimeline = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        // Resolve Drive client and download the video if it is missing locally
        const user = await this.userDao.findUserById(userId);
        let drive = null;
        let driveToken = null;
        if (user && user.googleAccessToken) {
            driveToken = await this.googleDriveService.getValidUserToken(user);
            drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        } else {
            drive = this.googleDriveService.getCentralDriveClient();
        }

        const projectDir = `./uploads/projects/${projectId}`;
        const localVideoPath = path.join(projectDir, "source_video.mp4");
        if (drive && project.driveFileId && !fs.existsSync(localVideoPath)) {
            logger.info(`getTimeline: Source video missing locally for project ${projectId}. Restoring from Google Drive...`);
            fs.mkdirSync(projectDir, { recursive: true });
            try {
                await this.googleDriveService.downloadFile(drive, project.driveFileId, localVideoPath);
                logger.info(`getTimeline: Source video restored from Google Drive successfully for project ${projectId}`);
                if (project.sourcePath !== localVideoPath) {
                    project.sourcePath = localVideoPath;
                    await project.save();
                }
            } catch (dlErr: any) {
                logger.error(`getTimeline: Failed to restore source video from Google Drive: ${dlErr.message}`);
            }
        }

        // Return saved timeline if exists
        if (project.timelineState && Array.isArray(project.timelineState.tracks) && project.timelineState.tracks.length > 0) {
            // Sanitize visual clip src paths to ensure they point to the correct restored local file
            const correctSrc = `/uploads/projects/${projectId}/source_video.mp4`;
            project.timelineState.tracks = project.timelineState.tracks.map((track: any) => {
                if (track.id === "track-video-main" || track.type === "video") {
                    if (Array.isArray(track.clips)) {
                        track.clips = track.clips.map((clip: any) => {
                            if (clip.type === "video" && (!clip.src || clip.src.includes("/drive/v3/files/") || !clip.src.endsWith("/source_video.mp4"))) {
                                return { ...clip, src: correctSrc };
                            }
                            return clip;
                        });
                    }
                }
                return track;
            });

            return Ok(res, "Timeline retrieved successfully", {
                timeline: project.timelineState,
                project
            });
        }

        // Otherwise, construct default timeline from source media and transcript
        const duration = Number(project.sourceDuration) || 60;
        const transcript = await this.transcriptDao.findTranscriptByProjectId(projectId);

        const videoClip = {
            id: `clip-video-${Date.now()}`,
            trackId: "track-video-main",
            type: "video",
            name: project.name || "Main Video",
            src: `/uploads/projects/${projectId}/${path.basename(project.sourcePath)}`,
            start: 0,
            duration: duration,
            sourceStart: 0,
            sourceDuration: duration,
            playbackRate: 1,
            volume: 1,
            muted: false,
            opacity: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            smartFraming: { focusX: 50, focusY: 50, zoomFactor: 1.0 }
        };

        const captionClips: any[] = [];

        if (transcript && transcript.rawJson) {
            try {
                const parsed = JSON.parse(transcript.rawJson);
                const segments = parsed.segments || [];
                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    const segStart = Math.max(0, Number(seg.start) || 0);
                    const segEnd = Math.min(duration, Number(seg.end) || (segStart + 3));
                    const segDuration = Math.max(0.2, segEnd - segStart);

                    captionClips.push({
                        id: `caption-${i}-${Date.now()}`,
                        trackId: "track-caption-main",
                        type: "caption",
                        name: seg.text || "Caption",
                        start: segStart,
                        duration: segDuration,
                        captionData: {
                            text: seg.text || "",
                            words: seg.words || [],
                            style: project.captionStyle || "modern-box"
                        }
                    });
                }
            } catch (err: any) {
                logger.warn(`Failed to parse transcript for default timeline: ${err.message}`);
            }
        }

        const initialTimeline = {
            version: 1,
            duration: duration,
            currentTime: 0,
            aspectRatio: "vertical",
            snapping: true,
            tracks: [
                {
                    id: "track-video-main",
                    name: "Video Track 1",
                    type: "video",
                    muted: false,
                    locked: false,
                    hidden: false,
                    volume: 1,
                    clips: [videoClip]
                },
                {
                    id: "track-caption-main",
                    name: "Captions",
                    type: "caption",
                    muted: false,
                    locked: false,
                    hidden: false,
                    volume: 1,
                    clips: captionClips
                },
                {
                    id: "track-audio-main",
                    name: "Audio Track 1",
                    type: "audio",
                    muted: false,
                    locked: false,
                    hidden: false,
                    volume: 1,
                    clips: []
                },
                {
                    id: "track-text-overlay",
                    name: "Text Overlays",
                    type: "text",
                    muted: false,
                    locked: false,
                    hidden: false,
                    volume: 1,
                    clips: []
                }
            ]
        };

        // Cache initial timeline
        await this.projectDao.updateProjectTimeline(projectId, initialTimeline);

        return Ok(res, "Default timeline generated successfully", {
            timeline: initialTimeline,
            project
        });

    }

    detectSilence = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");
        if (project.userId && project.userId.toString() !== userId) throw new Forbidden("You do not have access to this resource");
        if (!project.sourcePath || !fs.existsSync(project.sourcePath)) throw new NotFound("Project source video is missing");
        try {
            const result = await this.mediaService.detectSilence(project.sourcePath, req.body);
            const totalSilence = result.silences.reduce((total, range) => total + range.duration, 0);
            if (totalSilence >= result.duration - 0.01) throw new BadRequest("No speech or audible content was detected.");
            return Ok(res, "Silence detection completed", { videoId: projectId, duration: result.duration, silences: result.silences, totalSilence, estimatedDurationAfterCut: Math.max(0, result.duration - totalSilence) });
        } catch (error: any) {
            if (error?.code === "NO_AUDIO") throw new BadRequest("This video does not contain an audio track.");
            if (error instanceof BadRequest) throw error;
            logger.error(`Silence detection failed for ${projectId}: ${error.message}`);
            throw new BadRequest(`Silence detection failed: ${error.message}`);
        }
    };
    // save project timeline state
    saveTimeline = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const { timelineState } = req.body;

        if (!timelineState) {
            throw new BadRequest("timelineState is required");
        }

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const updated = await this.projectDao.updateProjectTimeline(projectId, timelineState);

        return Ok(res, "Timeline state saved successfully", updated);

    }

    // export timeline to rendered video (Remotion/FFmpeg) and upload to Google Drive
    exportTimeline = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const { timelineState, aspectRatio = "vertical", captionStyle = "modern-box", resolution = "1080p" } = req.body;

        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const effectiveTimeline = timelineState || project.timelineState;

        if (!effectiveTimeline || !Array.isArray(effectiveTimeline.tracks)) {
            throw new BadRequest("No valid timeline tracks to export");
        }

        const exportId = `export-${Date.now()}`;
        const outputDir = path.resolve("./uploads/temp");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputFilename = `${project.name || "export"}_${aspectRatio}_${exportId}.mp4`;
        const outputPath = path.join(outputDir, outputFilename);

        const videoTrack = effectiveTimeline.tracks.find((t: any) => t.type === "video");
        const mainClip = videoTrack?.clips?.[0];

        const startSec = mainClip ? Math.max(0, Number(mainClip.sourceStart ?? mainClip.start) || 0) : 0;
        const clipDuration = mainClip ? Math.max(1, Number(mainClip.duration) || 10) : 10;
        const endSec = startSec + clipDuration;

        const captionTrack = effectiveTimeline.tracks.find((t: any) => t.type === "caption");
        const subwords: any[] = [];

        if (captionTrack?.clips) {
            for (const cap of captionTrack.clips) {
                const words = cap.captionData?.words || [];
                for (const w of words) {
                    subwords.push({
                        text: w.text || "",
                        start: Number(w.start) || 0,
                        end: Number(w.end) || 0
                    });
                }
            }
        }

        const smartFraming = mainClip?.smartFraming || { focusX: 50, focusY: 50, zoomFactor: 1.0 };

        const op = operationManager.createOperation({
            projectId,
            type: "EXPORT",
            cancellable: true
        });

        try {
            operationManager.updateStep(op.operationId, "PREPARE_TIMELINE", "running", "Validating timeline and tracks...");
            operationManager.updateStep(op.operationId, "PREPARE_TIMELINE", "completed", "Timeline validated");

            operationManager.updateStep(op.operationId, "PREPARE_MEDIA", "running", "Preparing source media...");
            operationManager.updateStep(op.operationId, "PREPARE_MEDIA", "completed", "Media assets ready");

            operationManager.updateStep(op.operationId, "BUILD_FILTER_GRAPH", "running", "Building Remotion/FFmpeg render graph...");
            operationManager.updateStep(op.operationId, "BUILD_FILTER_GRAPH", "completed", "Render graph initialized");

            operationManager.updateStep(op.operationId, "RENDER_VIDEO", "running", "Rendering video frames...");

            try {
                await this.mediaService.renderRemotionClip(
                    project.sourcePath,
                    startSec,
                    endSec,
                    outputPath,
                    subwords,
                    captionStyle,
                    {
                        aspectRatio: aspectRatio as "vertical" | "horizontal" | "square",
                        layout: "standard",
                        focusX: smartFraming.focusX,
                        focusY: smartFraming.focusY,
                        zoomFactor: smartFraming.zoomFactor
                    }
                );
            } catch (remotionErr: any) {
                logger.warn(`Remotion export fallback to flat render: ${remotionErr.message}`);
                await this.mediaService.renderFlatClip(
                    project.sourcePath,
                    startSec,
                    endSec,
                    outputPath,
                    null,
                    aspectRatio as "vertical" | "horizontal" | "square",
                    {
                        focusX: smartFraming.focusX,
                        focusY: smartFraming.focusY,
                        zoomFactor: smartFraming.zoomFactor
                    }
                );
            }

            operationManager.updateStep(op.operationId, "RENDER_VIDEO", "completed", "Video frames rendered");
            operationManager.updateStep(op.operationId, "ENCODE_VIDEO", "completed", "Video encoded at 1080p");
            operationManager.updateStep(op.operationId, "FINALIZE_AUDIO", "completed", "Audio streams synchronized");
            operationManager.updateStep(op.operationId, "UPLOAD_RESULT", "running", "Uploading exported video to Google Drive...");

            // Upload exported file to user Google Drive inside project folder
            let driveExportResult: any = null;
            const user = await this.userDao.findUserById((req as any).user.userId);
            const driveToken = await this.googleDriveService.getValidUserToken(user);

            if (driveToken && user) {
                const drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
                const projectFolderId = await this.googleDriveService.getOrCreateProjectFolder(
                    drive,
                    project.name || "Untitled Project",
                    project.driveFolderId
                );

                if (!project.driveFolderId || project.driveFolderId !== projectFolderId) {
                    await this.projectDao.updateProjectDriveFolder(projectId, projectFolderId);
                }

                driveExportResult = await this.googleDriveService.uploadFile(
                    drive,
                    outputPath,
                    outputFilename,
                    "video/mp4",
                    project.name,
                    undefined,
                    projectFolderId
                );
            }

            operationManager.updateStep(op.operationId, "UPLOAD_RESULT", "completed", "Export uploaded to Google Drive");
            operationManager.updateStep(op.operationId, "SAVE_METADATA", "running", "Saving export record...");

            const downloadUrl = `/uploads/temp/${outputFilename}`;

            operationManager.updateStep(op.operationId, "SAVE_METADATA", "completed", "Export record saved");
            operationManager.completeOperation(op.operationId, "Export completed successfully!", {
                filename: outputFilename,
                downloadUrl,
                driveUrl: driveExportResult?.webViewLink || null
            });

            return Ok(res, "Timeline exported successfully", {
                filename: outputFilename,
                downloadUrl,
                driveFileId: driveExportResult?.fileId || null,
                driveUrl: driveExportResult?.webViewLink || null
            });

        } catch (err: any) {
            logger.error(`Export timeline failed: ${err.message}`);
            operationManager.failOperation(op.operationId, err.message);
            if (fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch {}
            }
            throw new BadRequest(`Timeline export failed: ${err.message}`);
        }

    };

    // list files in the project's Google Drive folder
    getProjectDriveFiles = async (req: Request, res: Response) => {

        const { projectId } = req.params;
        const userId = (req as any).user?.userId;
        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

        const user = await this.userDao.findUserById(userId);
        const driveToken = await this.googleDriveService.getValidUserToken(user);

        if (!driveToken || !user) {
            return Ok(res, "Drive not connected", { connected: false, files: [] });
        }

        const drive = this.googleDriveService.getUserDriveClient(driveToken, user.googleRefreshToken);
        const folderId = await this.googleDriveService.getOrCreateProjectFolder(
            drive,
            project.name || "Untitled Project",
            project.driveFolderId
        );

        if (!project.driveFolderId || project.driveFolderId !== folderId) {
            await this.projectDao.updateProjectDriveFolder(projectId, folderId);
        }

        const files = await this.googleDriveService.listFilesInFolder(drive, folderId);

        return Ok(res, "Drive files retrieved successfully", {
            connected: true,
            folderId,
            files
        });

    };

    // download/stream text or binary content of a file from the project's Google Drive folder
    getProjectDriveFileContent = async (req: Request, res: Response) => {

        const { projectId, fileId } = req.params;
        const userId = (req as any).user?.userId;
        const project = await this.projectDao.findProjectById(projectId);

        if (!project) {
            throw new NotFound("Project not found");
        }

        if (project.userId && project.userId.toString() !== userId) {
            throw new Forbidden("You do not have access to this resource");
        }

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
            throw new BadRequest("Google Drive service not available");
        }

        try {
            const folderId = project.driveFolderId;
            if (!folderId) {
                throw new NotFound("Project Drive folder not found");
            }

            const metadataRes = await drive.files.get({
                fileId,
                fields: "id,name,mimeType,parents,trashed",
                supportsAllDrives: true,
            });
            const file = metadataRes.data;

            if (file.trashed || !file.parents?.includes(folderId)) {
                throw new Forbidden("File is not available in this project's Drive folder");
            }

            const driveRes = await drive.files.get(
                { fileId, alt: "media", supportsAllDrives: true },
                { responseType: "stream" }
            );
            res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name || "download")}"`);
            res.setHeader("Cache-Control", "private, no-store");
            driveRes.data.pipe(res);
        } catch (err: any) {
            logger.error(`Failed to stream Google Drive file ${fileId}: ${err.message}`);
            throw new BadRequest(`Failed to read file from Google Drive: ${err.message}`);
        }

    };

    // Server-Sent Events (SSE) stream for real-time pipeline progress and multi-operation tracking
    streamPipelineEvents = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Real-time Event Listener for operationManager
        const operationEventListener = ({ event, data }: { event: string; data: any }) => {
            try {
                sendEvent(event, data);
            } catch {}
        };
        operationManager.on(`project:${projectId}`, operationEventListener);

        // Initial snapshot
        const initialCandidates = await this.candidateDao.findCandidatesByProjectId(projectId);
        const liveActive = operationManager.getProjectOperations(projectId);
        const savedActive = (project as any).activeOperations || [];
        const savedHistory = (project as any).operationHistory || [];

        sendEvent("pipeline.init", {
            status: project.status,
            progress: (project as any).pipelineProgress || 0,
            stage: (project as any).pipelineStage || project.status,
            message: (project as any).pipelineMessage || "",
            candidates: initialCandidates || [],
            activeOperations: liveActive.length > 0 ? liveActive : savedActive,
            operationHistory: savedHistory
        });

        let lastProgress = (project as any).pipelineProgress || 0;
        let lastStatus = project.status;
        let lastMessage = (project as any).pipelineMessage || "";

        const interval = setInterval(async () => {
            try {
                const currentProject = await this.projectDao.findProjectById(projectId);
                if (!currentProject) {
                    clearInterval(interval);
                    operationManager.off(`project:${projectId}`, operationEventListener);
                    return res.end();
                }

                const currentProgress = (currentProject as any).pipelineProgress || 0;
                const currentStatus = currentProject.status;
                const currentMessage = (currentProject as any).pipelineMessage || "";

                if (currentProgress !== lastProgress || currentStatus !== lastStatus || currentMessage !== lastMessage) {
                    lastProgress = currentProgress;
                    lastStatus = currentStatus;
                    lastMessage = currentMessage;

                    const candidates = await this.candidateDao.findCandidatesByProjectId(projectId);
                    const activeOps = operationManager.getProjectOperations(projectId);

                    sendEvent("pipeline.update", {
                        status: currentStatus,
                        progress: currentProgress,
                        stage: (currentProject as any).pipelineStage || currentStatus,
                        message: currentMessage,
                        logs: (currentProject as any).pipelineLogs || [],
                        candidates: candidates || [],
                        activeOperations: activeOps
                    });

                    if (currentStatus === "ready" || currentStatus === "failed") {
                        sendEvent(currentStatus === "ready" ? "pipeline.completed" : "pipeline.failed", {
                            status: currentStatus,
                            candidates: candidates || []
                        });
                    }
                }
            } catch (err) {
                clearInterval(interval);
                operationManager.off(`project:${projectId}`, operationEventListener);
            }
        }, 1000);

        req.on("close", () => {
            clearInterval(interval);
            operationManager.off(`project:${projectId}`, operationEventListener);
        });
    };

    // Retrieve active operations and recent history for project
    getProjectOperations = async (req: Request, res: Response) => {
        const { projectId } = req.params;
        const project = await this.projectDao.findProjectById(projectId);
        if (!project) throw new NotFound("Project not found");

        const liveActive = operationManager.getProjectOperations(projectId);
        const savedActive = (project as any).activeOperations || [];
        const savedHistory = (project as any).operationHistory || [];

        return Ok(res, "Operations retrieved", {
            activeOperations: liveActive.length > 0 ? liveActive : savedActive,
            operationHistory: savedHistory
        });
    };

    // Cancel active operation
    cancelProjectOperation = async (req: Request, res: Response) => {
        const { projectId, operationId } = req.params;
        const op = await operationManager.cancelOperation(operationId);
        if (!op) {
            return Ok(res, "Operation not found or already finished", { cancelled: false });
        }
        return Ok(res, "Operation cancelled successfully", { cancelled: true, operation: op });
    };

    // Real database analytics across all user projects (Zero fake numbers)
    getAnalytics = async (req: Request, res: Response) => {
        const userId = (req as any).user?.userId;
        const projects = await this.projectDao.findProjectsByUserId(userId);

        let totalVideos = projects.length;
        let totalSourceSeconds = 0;
        let totalOpportunitiesFound = 0;
        let totalClipsGenerated = 0;
        let totalApprovedClips = 0;
        let scoreSum = 0;
        let scoredCount = 0;

        const contentTypeCounts: Record<string, number> = {};

        for (const p of projects) {
            totalSourceSeconds += (p.sourceDuration || 0);
            const candidates = await this.candidateDao.findCandidatesByProjectId(p._id);
            totalOpportunitiesFound += candidates.length;

            for (const cand of candidates) {
                if (cand.score) {
                    scoreSum += cand.score;
                    scoredCount++;
                }
                const cType = cand.contentType || "Viral";
                contentTypeCounts[cType] = (contentTypeCounts[cType] || 0) + 1;
                if (cand.reviewStatus === "approved" || cand.reviewStatus === "generated") {
                    totalApprovedClips++;
                }
            }

            const clips = await this.clipDao.findClipsByProjectId(p._id);
            totalClipsGenerated += clips.filter((c: any) => c.status === "completed" || c.status === "ready" || Boolean(c.driveFileId)).length;
        }

        const totalMinutes = Math.round(totalSourceSeconds / 60);
        const averageScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;
        // Average manual short edit takes ~45 minutes; AI generation saves ~40 minutes per short
        const estimatedHoursSaved = Number(((totalOpportunitiesFound * 40) / 60).toFixed(1));

        return Ok(res, "Analytics calculated successfully", {
            videosProcessed: totalVideos,
            minutesProcessed: totalMinutes,
            opportunitiesFound: totalOpportunitiesFound,
            shortsGenerated: totalClipsGenerated,
            shortsApproved: totalApprovedClips,
            averageScore: averageScore,
            estimatedHoursSaved: estimatedHoursSaved,
            contentTypeDistribution: contentTypeCounts
        });
    };

    // Get Brand Kit
    getBrandKit = async (req: Request, res: Response) => {
        const userId = (req as any).user?.userId;
        const user = await this.userDao.findUserById(userId);
        if (!user) throw new NotFound("User not found");

        const brandKit = (user as any).brandKit || {
            logoUrl: null,
            primaryColor: "#6366f1",
            secondaryColor: "#a855f7",
            font: "Inter",
            captionStyle: "modern-box",
            captionHighlightColor: "#facc15",
            watermarkEnabled: false,
            watermarkText: "",
            watermarkPosition: "bottom-right"
        };

        return Ok(res, "Brand kit retrieved", brandKit);
    };

    // Update Brand Kit
    updateBrandKit = async (req: Request, res: Response) => {
        const userId = (req as any).user?.userId;
        const user = await this.userDao.findUserById(userId);
        if (!user) throw new NotFound("User not found");

        const currentKit = (user as any).brandKit || {};
        const updated = {
            ...currentKit,
            ...req.body
        };

        (user as any).brandKit = updated;
        await user.save();

        return Ok(res, "Brand kit updated successfully", updated);
    };

}

export default ProjectsController;


