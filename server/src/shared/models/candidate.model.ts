// Importing module
import mongoose from "mongoose";

// defining the schema for the candidate model
const candidateSchema = new mongoose.Schema({

    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: [true, "Project ID is required"]
    },

    startSec: {
        type: Number,
        required: [true, "Start second is required"]
    },

    endSec: {
        type: Number,
        required: [true, "End second is required"]
    },

    score: {
        type: Number,
        required: [true, "Score is required"]
    },

    hook: {
        type: String,
        required: [true, "Hook is required"]
    },

    rationale: {
        type: String,
        required: [true, "Rationale is required"]
    },

    rank: {
        type: Number,
        required: [true, "Rank is required"]
    },

    title: {
        type: String,
        default: null
    },

    duration: {
        type: Number,
        default: null
    },

    // Content Intelligence properties
    contentType: {
        type: String,
        default: "Viral"
    },

    secondaryTypes: {
        type: [String],
        default: []
    },

    topic: {
        type: String,
        default: null
    },

    subtopic: {
        type: String,
        default: null
    },

    summary: {
        type: String,
        default: null
    },

    emotion: {
        type: String,
        default: null
    },

    audience: {
        type: String,
        default: null
    },

    hookType: {
        type: String,
        default: "Curiosity"
    },

    recommendedPlatforms: {
        type: [String],
        default: ["TikTok", "Instagram Reels", "YouTube Shorts"]
    },

    suggestedTitles: {
        type: [
            {
                title: { type: String },
                style: { type: String },
                score: { type: Number, default: 85 }
            }
        ],
        default: []
    },

    suggestedHooks: {
        type: [
            {
                hook: { type: String },
                hookType: { type: String },
                score: { type: Number, default: 85 },
                reason: { type: String }
            }
        ],
        default: []
    },

    suggestedCaptions: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    reviewStatus: {
        type: String,
        enum: ["ai_found", "reviewing", "approved", "rejected", "generating", "generated"],
        default: "ai_found"
    },

    scoreBreakdown: {
        hook: { type: Number, default: 0 },
        standalone: { type: Number, default: 0 },
        emotion: { type: Number, default: 0 },
        curiosity: { type: Number, default: 0 },
        payoff: { type: Number, default: 0 },
        formatFit: { type: Number, default: 0 },
        visualInterest: { type: Number, default: 0 },
        context: { type: Number, default: 0 },
        shareability: { type: Number, default: 0 }
    },

    selected: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

// making the model for the candidate schema
const Candidate = mongoose.model("Candidate", candidateSchema);

// exporting the candidate model
export default Candidate;
