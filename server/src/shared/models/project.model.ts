// Importing module
import mongoose from "mongoose";

// defining the schema for the project model
const projectSchema = new mongoose.Schema({

    name: {
        type: String,
        default: null
    },

    sourcePath: {
        type: String,
        required: [true, "Source path is required"]
    },

    originalName: {
        type: String,
        default: null
    },

    sourceDuration: {
        type: Number,
        default: null
    },

    status: {
        type: String,
        required: [true, "Status is required"],
        default: "ingest"
    },

    transcriptionMode: {
        type: String,
        required: [true, "Transcription mode is required"],
        default: "local"
    },

    captionStyle: {
        type: String,
        default: "modern-box"
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },

    driveFileId: {
        type: String,
        default: null
    },

    audioDriveFileId: {
        type: String,
        default: null
    },

    driveFolderId: {
        type: String,
        default: null
    },

    timelineState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    uploadProgress: {
        type: Number,
        default: 0
    },

    uploadStage: {
        type: String,
        default: null
    },

    uploadLoadedBytes: {
        type: Number,
        default: 0
    },

    uploadTotalBytes: {
        type: Number,
        default: 0
    },

    pipelineProgress: {
        type: Number,
        default: 0
    },

    pipelineStage: {
        type: String,
        default: null
    },

    pipelineMessage: {
        type: String,
        default: null
    },

    pipelineLogs: {
        type: [String],
        default: []
    }

}, {
    timestamps: true
});

// making the model for the project schema
const Project = mongoose.model("Project", projectSchema);

// exporting the project model
export default Project;


