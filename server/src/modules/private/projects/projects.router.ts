// Importing modules
import express from "express";
import ProjectsController from "./projects.controller.js";
import upload from "../../../shared/utils/multer.util.js";
import {
    createProjectValidators,
    getProjectValidators,
    renameProjectValidators,
    updateClipCountValidators,
    detectSilenceValidators
} from "./projects.validator.js";

// making the router
const router = express.Router();

// creating a projects controller instance
const controller = new ProjectsController();

router.post("/import", upload.single("media"), createProjectValidators, controller.createProject);

/*
    @route POST /api/projects/init-upload
    @desc Initialize project upload, create placeholder record
    @access Private
*/
router.post("/init-upload", createProjectValidators, controller.initUpload);

/*
    @route POST /api/projects/:projectId/upload-media
    @desc Upload media file to server and Google Drive
    @access Private
*/
router.post("/:projectId/upload-media", upload.single("media"), getProjectValidators, controller.uploadMedia);

/*
    @route GET /api/projects
    @desc List all projects sorted by update time
    @access Private
*/
router.get("/", controller.listProjects);

/*
    @route GET /api/projects/analytics
    @desc Real database analytics across all user projects
    @access Private
*/
router.get("/analytics", controller.getAnalytics);

/*
    @route GET /api/projects/brand-kit
    @desc Retrieve user brand kit configuration
    @access Private
*/
router.get("/brand-kit", controller.getBrandKit);

/*
    @route PUT /api/projects/brand-kit
    @desc Save user brand kit configuration
    @access Private
*/
router.put("/brand-kit", controller.updateBrandKit);

/*
    @route GET /api/projects/:projectId/pipeline-stream
    @desc Server-Sent Events (SSE) stream for real-time pipeline status
    @access Private
*/
router.get("/:projectId/pipeline-stream", getProjectValidators, controller.streamPipelineEvents);

/*
    @route GET /api/projects/:projectId/operations
    @desc Retrieve active operations and recent history for project
    @access Private
*/
router.get("/:projectId/operations", getProjectValidators, controller.getProjectOperations);

/*
    @route POST /api/projects/:projectId/operations/:operationId/cancel
    @desc Cancel a running operation
    @access Private
*/
router.post("/:projectId/operations/:operationId/cancel", getProjectValidators, controller.cancelProjectOperation);

/*
    @route GET /api/projects/:projectId
    @desc Retrieve detailed data including project, transcript, candidates, and clips
    @access Private
*/
router.get("/:projectId", getProjectValidators, controller.getProjectDetail);

/*
    @route PUT /api/projects/:projectId/rename
    @desc Rename a project
    @access Private
*/
router.put("/:projectId/rename", renameProjectValidators, controller.renameProject);

/*
    @route DELETE /api/projects/:projectId
    @desc Delete a project and cleanup files
    @access Private
*/
router.delete("/:projectId", getProjectValidators, controller.deleteProject);

/*
    @route POST /api/projects/:projectId/transcribe
    @desc Transcribe project audio using selected engine
    @access Private
*/
router.post("/:projectId/transcribe", getProjectValidators, controller.transcribeProject);
router.post("/:projectId/detect-silence", detectSilenceValidators, controller.detectSilence);

/*
    @route POST /api/projects/:projectId/moments
    @desc Find viral moments using LLM provider
    @access Private
*/
router.post("/:projectId/moments", getProjectValidators, controller.generateCandidates);

/*
    @route POST /api/projects/:projectId/clip-count
    @desc Set selected clip counts
    @access Private
*/
router.post("/:projectId/clip-count", updateClipCountValidators, controller.updateClipCount);

/*
    @route PUT /api/projects/:projectId/transcript
    @desc Update transcript words array
    @access Private
*/
router.put("/:projectId/transcript", getProjectValidators, controller.updateTranscript);

/*
    @route POST /api/projects/:projectId/auto-pipeline
    @desc Run end-to-end video pipeline (Transcribe -> Analyze -> Render Multiple Shorts -> Drive Upload)
    @access Private
*/
router.post("/:projectId/auto-pipeline", getProjectValidators, controller.runAutoPipeline);

/*
    @route GET /api/projects/:projectId/pipeline-status
    @desc Retrieve real-time progress and logs of auto-pipeline
    @access Private
*/
router.get("/:projectId/pipeline-status", getProjectValidators, controller.getPipelineStatus);

/*
    @route GET /api/projects/:projectId/timeline
    @desc Retrieve project timeline state (or generate default)
    @access Private
*/
router.get("/:projectId/drive-timeline", getProjectValidators, controller.loadDriveTimeline);
router.put("/:projectId/drive-timeline", getProjectValidators, controller.saveDriveTimeline);
router.get("/:projectId/timeline", getProjectValidators, controller.getTimeline);

/*
    @route PUT /api/projects/:projectId/timeline
    @desc Save project timeline state
    @access Private
*/
router.put("/:projectId/timeline", getProjectValidators, controller.saveTimeline);

/*
    @route POST /api/projects/:projectId/export-timeline
    @desc Render and export multi-track timeline video to Google Drive
    @access Private
*/
router.post("/:projectId/export-timeline", getProjectValidators, controller.exportTimeline);

/*
    @route GET /api/projects/:projectId/drive-files
    @desc List files in project's Google Drive folder
    @access Private
*/
router.get("/:projectId/drive-files", getProjectValidators, controller.getProjectDriveFiles);

/*
    @route GET /api/projects/:projectId/drive-files/:fileId/content
    @desc Stream/fetch content of a file in project's Google Drive folder
    @access Private
*/
router.get("/:projectId/drive-files/:fileId/content", getProjectValidators, controller.getProjectDriveFileContent);

// exporting the router
export default router;

