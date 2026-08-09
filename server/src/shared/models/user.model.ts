// Importing module
import mongoose from "mongoose";
import { hashPassword, comparePassword } from "../utils/hashing.util.js";

// defining the schema for the user model
const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: [true, "Name is required"],
        minlength: [3, "Name must be at least 3 characters long"],
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        match: [/\S+@\S+\.\S+/, "Email is invalid"],
    },

    password: {
        type: String,
        required: false,
        minlength: [6, "Password must be at least 6 characters long"],
    },

    providers: {
        type: [String],
        enum: ["local", "google"],
        default: ["local"],
    },

    googleId: {
        type: String,
        required: false,
    },

    googleAccessToken: {
        type: String,
        required: false,
    },

    googleRefreshToken: {
        type: String,
        required: false,
    },

    googleTokenExpiry: {
        type: Date,
        required: false,
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    // User-provided API keys (stored securely on the user document)
    deepgramKey: {
        type: String,
        default: null
    },

    anthropicKey: {
        type: String,
        default: null
    },

    deepseekKey: {
        type: String,
        default: null
    },

    geminiKey: {
        type: String,
        default: null
    },

    openaiKey: {
        type: String,
        default: null
    },

    openrouterKey: {
        type: String,
        default: null
    },

    groqKey: {
        type: String,
        default: null
    },

    mistralKey: {
        type: String,
        default: null
    }



}, {
    timestamps: true
});

// adding a pre-save hook to hash the password before saving the user
userSchema.pre("save", async function() {

    // checking if the password is modified or exists
    if (!this.isModified("password") || !this.password) return;

    // hashing the password
    this.password = await hashPassword(this.password);

});

// adding a method to compare the password
userSchema.methods.comparePassword = async function(password: string) {

    // checking if the user has a password
    if (!this.password) return false;

    // comparing the password with the hashed password
    return await comparePassword(password, this.password);

};

// making the model for the user schema
const User = mongoose.model("User", userSchema);

// exporting the user model
export default User;
