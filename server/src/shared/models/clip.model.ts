// Importing module
import mongoose from "mongoose";

// defining the schema for the clip model
const clipSchema = new mongoose.Schema({

    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: [true, "Candidate ID is required"]
    },

    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: [true, "Project ID is required"]
    },

    status: {
        type: String,
        required: [true, "Status is required"],
        default: "pending"
    },

    outputPath: {
        type: String,
        default: null
    },

    faceTrackJson: {
        type: String,
        default: null
    },

    captionAssPath: {
        type: String,
        default: null
    },

    captionStyle: {
        type: String,
        default: null
    },

    layout: {
        type: String,
        default: "standard"
    },

    zoomFactor: {
        type: Number,
        default: 1.0
    },

    focusX: {
        type: Number,
        default: 50
    },

    focusY: {
        type: Number,
        default: 50
    },

    aspectRatio: {
        type: String,
        default: "vertical"
    },

    renderLog: {
        type: String,
        default: null
    },

    // cloudinary CDN storage fields (populated after successful upload)
    cloudinaryUrl: {
        type: String,
        default: null
    },

    cloudinaryPublicId: {
        type: String,
        default: null
    },

    driveFileId: {
        type: String,
        default: null
    },

    driveUrl: {
        type: String,
        default: null
    },

    outputPathHorizontal: {
        type: String,
        default: null
    },

    driveFileIdHorizontal: {
        type: String,
        default: null
    },

    driveUrlHorizontal: {
        type: String,
        default: null
    }


}, {
    timestamps: true
});

// making the model for the clip schema
const Clip = mongoose.model("Clip", clipSchema);

// exporting the clip model
export default Clip;
