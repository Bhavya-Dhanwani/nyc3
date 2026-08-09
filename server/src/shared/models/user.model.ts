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
    deepgramKeys: {
        type: [String],
        default: []
    },

    anthropicKeys: {
        type: [String],
        default: []
    },

    deepseekKeys: {
        type: [String],
        default: []
    },

    geminiKeys: {
        type: [String],
        default: []
    },

    openaiKeys: {
        type: [String],
        default: []
    },

    openrouterKeys: {
        type: [String],
        default: []
    },

    groqKeys: {
        type: [String],
        default: []
    },

    mistralKeys: {
        type: [String],
        default: []
    }


}, {
    timestamps: true
});

// adding a pre-save hook to hash the password before saving the user
userSchema.pre("save", async function() {

    // Migrate old string keys to new array fields for backward compatibility
    const keyMap = [
        { old: 'deepgramKey', new: 'deepgramKeys' },
        { old: 'anthropicKey', new: 'anthropicKeys' },
        { old: 'deepseekKey', new: 'deepseekKeys' },
        { old: 'geminiKey', new: 'geminiKeys' },
        { old: 'openaiKey', new: 'openaiKeys' },
        { old: 'openrouterKey', new: 'openrouterKeys' },
        { old: 'groqKey', new: 'groqKeys' },
        { old: 'mistralKey', new: 'mistralKeys' }
    ];

    for (const { old, new: newField } of keyMap) {
        if (this.get(old) && typeof this.get(old) === 'string') {
            const arr = this.get(newField) || [];
            if (!arr.includes(this.get(old))) {
                this.set(newField, [...arr, this.get(old)]);
            }
            this.set(old, undefined);
        }
    }

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


