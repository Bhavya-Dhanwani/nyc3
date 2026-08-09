// Importing module
import mongoose from "mongoose";

// defining the schema for the transcript model
const transcriptSchema = new mongoose.Schema({

    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: [true, "Project ID is required"]
    },

    engine: {
        type: String,
        required: [true, "Engine is required"]
    },

    rawJson: {
        type: String,
        required: [true, "Raw JSON transcript data is required"]
    },

    language: {
        type: String,
        default: "en"
    }

}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
});

// making the model for the transcript schema
const Transcript = mongoose.model("Transcript", transcriptSchema);

// exporting the transcript model
export default Transcript;
