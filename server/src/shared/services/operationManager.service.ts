import { EventEmitter } from "events";
import logger from "../config/logger.config.js";
import Project from "../models/project.model.js";

export type OperationType =
  | "VIDEO_ANALYSIS"
  | "TRANSCRIPTION"
  | "CLIP_GENERATION"
  | "CAPTION_GENERATION"
  | "AI_EDIT_ASSISTANT"
  | "BRAND_KIT_GENERATION"
  | "CONTENT_PACKAGE_GENERATION"
  | "THUMBNAIL_GENERATION"
  | "EXPORT"
  | "DRIVE_SAVE"
  | "DRIVE_RESTORE";

export type OperationStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface OperationStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
  progress?: number;
}

export interface Operation {
  operationId: string;
  projectId: string;
  type: OperationType;
  title: string;
  status: OperationStatus;
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  steps: OperationStep[];
  progress: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  result?: any;
  cancellable?: boolean;
}

// Predefined multi-step pipeline templates
export const OPERATION_TEMPLATES: Record<OperationType, { title: string; steps: Array<{ id: string; label: string }> }> = {
  VIDEO_ANALYSIS: {
    title: "AI Video Analysis",
    steps: [
      { id: "PREPARE_VIDEO", label: "Preparing video" },
      { id: "EXTRACT_AUDIO", label: "Extracting audio" },
      { id: "TRANSCRIBE_AUDIO", label: "Transcribing video with Groq" },
      { id: "DETECT_TOPICS", label: "Detecting topics & content structure" },
      { id: "DETECT_CONTENT_TYPES", label: "Detecting content types & hooks" },
      { id: "FIND_HOOKS", label: "Finding high-potential moments" },
      { id: "SCORE_CANDIDATES", label: "Scoring candidate clips" },
      { id: "BUILD_CONTENT_MAP", label: "Building Content Map" },
      { id: "SAVE_ANALYSIS", label: "Saving analysis & metadata" },
    ],
  },
  TRANSCRIPTION: {
    title: "Transcribing Video",
    steps: [
      { id: "PREPARE_AUDIO", label: "Preparing audio" },
      { id: "UPLOAD_AUDIO", label: "Uploading audio" },
      { id: "TRANSCRIBE_GROQ", label: "Transcribing with Groq" },
      { id: "PROCESS_TIMESTAMPS", label: "Processing timestamps" },
      { id: "SAVE_TRANSCRIPT", label: "Saving transcript" },
    ],
  },
  CLIP_GENERATION: {
    title: "Generating Short Clip",
    steps: [
      { id: "SELECT_CANDIDATE", label: "Candidate selected" },
      { id: "PREPARE_RANGE", label: "Source range prepared" },
      { id: "CREATE_TIMELINE", label: "Creating timeline" },
      { id: "LOAD_CAPTIONS", label: "Loading captions" },
      { id: "APPLY_AI_EDITS", label: "Applying AI edits" },
      { id: "APPLY_BRAND_KIT", label: "Applying Brand Kit" },
      { id: "PREPARE_EXPORT", label: "Preparing export" },
      { id: "RENDER_VIDEO", label: "Rendering video" },
      { id: "SAVE_PROJECT", label: "Saving project" },
    ],
  },
  CAPTION_GENERATION: {
    title: "Generating Captions",
    steps: [
      { id: "LOAD_TRANSCRIPT", label: "Transcript loaded" },
      { id: "CONVERT_SEGMENTS", label: "Converting transcript to caption segments" },
      { id: "APPLY_TIMING", label: "Applying caption timing" },
      { id: "APPLY_BRAND_STYLE", label: "Applying Brand Kit style" },
      { id: "ADD_TO_TIMELINE", label: "Adding captions to timeline" },
      { id: "SAVE_PROJECT", label: "Saving project" },
    ],
  },
  AI_EDIT_ASSISTANT: {
    title: "AI Edit Assistant",
    steps: [
      { id: "UNDERSTAND_REQUEST", label: "Understanding request" },
      { id: "READ_TIMELINE", label: "Reading current timeline" },
      { id: "GENERATE_PLAN", label: "Generating edit plan" },
      { id: "VALIDATE_OPERATIONS", label: "Validating operations" },
      { id: "APPLY_OPERATIONS", label: "Applying timeline edits" },
      { id: "SAVE_CHANGES", label: "Saving changes" },
    ],
  },
  BRAND_KIT_GENERATION: {
    title: "Generating Brand Kit",
    steps: [
      { id: "UNDERSTAND_CONTENT", label: "Understanding content" },
      { id: "CREATE_IDENTITY", label: "Creating visual identity" },
      { id: "SELECT_TYPOGRAPHY", label: "Selecting typography" },
      { id: "CREATE_CAPTION_STYLE", label: "Creating caption style" },
      { id: "PREPARE_WATERMARK", label: "Preparing watermark settings" },
      { id: "SAVE_BRAND_KIT", label: "Saving Brand Kit" },
    ],
  },
  CONTENT_PACKAGE_GENERATION: {
    title: "Generating Content Package",
    steps: [
      { id: "UNDERSTAND_CLIP", label: "Understanding clip context" },
      { id: "GEN_TITLES", label: "Generating title options" },
      { id: "GEN_DESCRIPTION", label: "Generating description" },
      { id: "GEN_INSTAGRAM", label: "Generating Instagram caption" },
      { id: "GEN_TIKTOK", label: "Generating TikTok caption" },
      { id: "GEN_YOUTUBE", label: "Generating YouTube metadata" },
      { id: "GEN_LINKEDIN", label: "Generating LinkedIn post" },
      { id: "GEN_X", label: "Generating X post" },
      { id: "GEN_HASHTAGS", label: "Generating viral hashtags" },
      { id: "GEN_THUMBNAIL", label: "Generating custom thumbnail" },
      { id: "SAVE_PACKAGE", label: "Saving content package" },
    ],
  },
  THUMBNAIL_GENERATION: {
    title: "Generating Thumbnail",
    steps: [
      { id: "READ_CONTEXT", label: "Reading clip context" },
      { id: "SELECT_FRAME", label: "Selecting important frame" },
      { id: "CREATE_CONCEPT", label: "Creating thumbnail concept" },
      { id: "GENERATE_IMAGE", label: "Generating image" },
      { id: "SAVE_THUMBNAIL", label: "Saving thumbnail" },
    ],
  },
  EXPORT: {
    title: "Exporting Video",
    steps: [
      { id: "PREPARE_TIMELINE", label: "Preparing timeline" },
      { id: "PREPARE_MEDIA", label: "Preparing media assets" },
      { id: "BUILD_FILTER_GRAPH", label: "Building FFmpeg filter graph" },
      { id: "RENDER_VIDEO", label: "Rendering video" },
      { id: "ENCODE_VIDEO", label: "Encoding video" },
      { id: "FINALIZE_AUDIO", label: "Finalizing audio" },
      { id: "UPLOAD_RESULT", label: "Uploading export" },
      { id: "SAVE_METADATA", label: "Saving export metadata" },
    ],
  },
  DRIVE_SAVE: {
    title: "Saving to Google Drive",
    steps: [
      { id: "CHECK_CHANGES", label: "Checking unsaved changes" },
      { id: "SYNC_DRIVE", label: "Syncing to Google Drive" },
      { id: "CONFIRM_SAVE", label: "Confirming save" },
    ],
  },
  DRIVE_RESTORE: {
    title: "Restoring Project from Drive",
    steps: [
      { id: "FIND_PROJECT", label: "Project found" },
      { id: "LOAD_JSON", label: "Loading project JSON" },
      { id: "VALIDATE_PROJECT", label: "Validating project" },
      { id: "RESTORE_TIMELINE", label: "Restoring timeline" },
      { id: "RESTORE_CAPTIONS", label: "Restoring captions" },
      { id: "RESTORE_EFFECTS", label: "Restoring effects" },
      { id: "RESTORE_KEYFRAMES", label: "Restoring keyframes" },
      { id: "RESTORE_BRAND_KIT", label: "Restoring Brand Kit" },
      { id: "RESTORE_METADATA", label: "Restoring content intelligence" },
      { id: "COMPLETE", label: "Project restored" },
    ],
  },
};

class OperationManagerService extends EventEmitter {
  private activeOperations: Map<string, Operation> = new Map();
  private cancelHandlers: Map<string, () => Promise<void> | void> = new Map();

  constructor() {
    super();
    this.setMaxListeners(0);
  }

  // Create a new operation and emit creation event
  createOperation(params: {
    projectId: string;
    type: OperationType;
    customTitle?: string;
    customSteps?: Array<{ id: string; label: string }>;
    cancellable?: boolean;
    cancelHandler?: () => Promise<void> | void;
  }): Operation {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const template = OPERATION_TEMPLATES[params.type] || {
      title: params.customTitle || "Operation",
      steps: params.customSteps || [{ id: "STEP_1", label: "Processing" }],
    };

    const steps: OperationStep[] = (params.customSteps || template.steps).map((s) => ({
      id: s.id,
      label: s.label,
      status: "pending",
    }));

    const now = new Date().toISOString();
    const op: Operation = {
      operationId,
      projectId: params.projectId,
      type: params.type,
      title: params.customTitle || template.title,
      status: "RUNNING",
      currentStep: steps[0]?.id || "",
      stepIndex: 0,
      totalSteps: steps.length,
      steps,
      progress: 0,
      message: steps[0]?.label ? `Starting: ${steps[0].label}` : "Starting...",
      startedAt: now,
      updatedAt: now,
      cancellable: Boolean(params.cancellable),
    };

    if (steps.length > 0) {
      steps[0].status = "running";
    }

    this.activeOperations.set(operationId, op);

    if (params.cancelHandler) {
      this.cancelHandlers.set(operationId, params.cancelHandler);
    }

    this.broadcastEvent(op.projectId, "operation.created", op);
    this.persistOperation(op).catch((err) => logger.warn(`Failed to persist created operation: ${err.message}`));

    return op;
  }

  // Update current step or transition to next step
  updateStep(
    operationId: string,
    stepId: string,
    stepStatus: "running" | "completed" | "failed",
    message?: string,
    resultData?: any
  ): Operation | null {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;

    const stepIndex = op.steps.findIndex((s) => s.id === stepId);
    if (stepIndex >= 0) {
      op.steps[stepIndex].status = stepStatus;
      if (message) op.steps[stepIndex].message = message;
      op.stepIndex = stepIndex;
      op.currentStep = stepId;
    }

    // Auto mark previous steps as completed
    if (stepStatus === "running" && stepIndex > 0) {
      for (let i = 0; i < stepIndex; i++) {
        if (op.steps[i].status !== "completed") {
          op.steps[i].status = "completed";
        }
      }
    }

    // Calculate progress based on completed steps
    const completedCount = op.steps.filter((s) => s.status === "completed").length;
    const runningCount = op.steps.filter((s) => s.status === "running").length;
    const calculatedProgress = Math.round(
      Math.min(99, ((completedCount + runningCount * 0.5) / Math.max(1, op.totalSteps)) * 100)
    );

    op.progress = calculatedProgress;
    op.updatedAt = new Date().toISOString();
    if (message) op.message = message;
    if (resultData !== undefined) {
      op.result = { ...(op.result || {}), ...resultData };
    }

    const eventName = stepStatus === "completed" ? "operation.step_completed" : "operation.step_started";
    this.broadcastEvent(op.projectId, eventName, op);
    this.persistOperation(op).catch((err) => logger.warn(`Failed to persist step update: ${err.message}`));

    return op;
  }

  // Update explicit progress (e.g. FFmpeg 0..100)
  updateProgress(operationId: string, progress: number, message?: string): Operation | null {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;

    op.progress = Math.max(0, Math.min(100, Math.round(progress)));
    op.updatedAt = new Date().toISOString();
    if (message) op.message = message;

    this.broadcastEvent(op.projectId, "operation.progress", op);
    return op;
  }

  // Complete operation successfully
  completeOperation(operationId: string, message = "Operation completed successfully", result?: any): Operation | null {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;

    op.status = "COMPLETED";
    op.progress = 100;
    op.message = message;
    op.completedAt = new Date().toISOString();
    op.updatedAt = op.completedAt;
    if (result !== undefined) op.result = result;

    // Mark all steps as completed
    for (const step of op.steps) {
      step.status = "completed";
    }

    this.broadcastEvent(op.projectId, "operation.completed", op);
    this.persistOperation(op).catch((err) => logger.warn(`Failed to persist completed operation: ${err.message}`));

    this.cancelHandlers.delete(operationId);
    // Keep in active map briefly so polling/clients receive it, then archive
    setTimeout(() => {
      this.activeOperations.delete(operationId);
    }, 60000);

    return op;
  }

  // Mark operation as failed
  failOperation(operationId: string, errorMessage: string): Operation | null {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;

    op.status = "FAILED";
    op.error = errorMessage;
    op.message = `Failed: ${errorMessage}`;
    op.completedAt = new Date().toISOString();
    op.updatedAt = op.completedAt;

    const currentStepObj = op.steps.find((s) => s.id === op.currentStep);
    if (currentStepObj) {
      currentStepObj.status = "failed";
      currentStepObj.message = errorMessage;
    }

    this.broadcastEvent(op.projectId, "operation.failed", op);
    this.persistOperation(op).catch((err) => logger.warn(`Failed to persist failed operation: ${err.message}`));

    this.cancelHandlers.delete(operationId);
    setTimeout(() => {
      this.activeOperations.delete(operationId);
    }, 60000);

    return op;
  }

  // Cancel operation
  async cancelOperation(operationId: string): Promise<Operation | null> {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;

    const handler = this.cancelHandlers.get(operationId);
    if (handler) {
      try {
        await handler();
      } catch (err: any) {
        logger.warn(`Error running cancel handler for operation ${operationId}: ${err.message}`);
      }
    }

    op.status = "CANCELLED";
    op.message = "Operation was cancelled by user";
    op.completedAt = new Date().toISOString();
    op.updatedAt = op.completedAt;

    this.broadcastEvent(op.projectId, "operation.cancelled", op);
    this.persistOperation(op).catch((err) => logger.warn(`Failed to persist cancelled operation: ${err.message}`));

    this.cancelHandlers.delete(operationId);
    setTimeout(() => {
      this.activeOperations.delete(operationId);
    }, 30000);

    return op;
  }

  // Get all active and recent operations for a project
  getProjectOperations(projectId: string): Operation[] {
    const result: Operation[] = [];
    for (const op of this.activeOperations.values()) {
      if (op.projectId === projectId) {
        result.push(op);
      }
    }
    return result;
  }

  // Get specific operation
  getOperation(operationId: string): Operation | undefined {
    return this.activeOperations.get(operationId);
  }

  // Broadcast event to project listeners
  private broadcastEvent(projectId: string, event: string, data: any) {
    this.emit(`project:${projectId}`, { event, data });
  }

  // Persist operation snapshot to project document in MongoDB
  private async persistOperation(op: Operation) {
    try {
      const project = await Project.findById(op.projectId);
      if (!project) return;

      const activeOps: Operation[] = (project as any).activeOperations || [];
      const history: Operation[] = (project as any).operationHistory || [];

      // Update or add in activeOps
      const filteredActive = activeOps.filter((o) => o.operationId !== op.operationId);
      if (op.status === "RUNNING" || op.status === "QUEUED") {
        filteredActive.push(op);
      } else {
        // Move to history (keep top 20 recent)
        history.unshift(op);
        if (history.length > 20) history.splice(20);
      }

      await Project.findByIdAndUpdate(op.projectId, {
        activeOperations: filteredActive,
        operationHistory: history,
        pipelineProgress: op.progress,
        pipelineStage: op.currentStep,
        pipelineMessage: op.message,
      });
    } catch (err: any) {
      logger.warn(`Failed to persist operation ${op.operationId}: ${err.message}`);
    }
  }
}

export const operationManager = new OperationManagerService();
export default operationManager;
