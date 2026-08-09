// Importing modules
import { param, body } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";
import mongoose from "mongoose";

const createProjectValidators = [

    // validating transcriptionEngine
    body("transcriptionEngine")
        .optional()
        .isIn(["local", "deepgram"])
        .withMessage("Transcription engine must be local or deepgram"),

    // validating captionStyle
    body("captionStyle")
        .optional(),

    validateErrors

];

const getProjectValidators = [

    // validating the projectId param
    param("projectId")
        .notEmpty()
        .withMessage("Project ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Project ID"),

    validateErrors

];

const renameProjectValidators = [

    // validating the projectId param
    param("projectId")
        .notEmpty()
        .withMessage("Project ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Project ID"),

    // validating the name field
    body("name")
        .notEmpty()
        .withMessage("Project name is required")
        .isString()
        .withMessage("Name must be a string"),

    validateErrors

];

const updateClipCountValidators = [

    // validating the projectId param
    param("projectId")
        .notEmpty()
        .withMessage("Project ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Project ID"),

    // validating the count field
    body("count")
        .notEmpty()
        .withMessage("Clip count is required")
        .isInt({ min: 0 })
        .withMessage("Count must be a positive integer"),

    validateErrors

];

const detectSilenceValidators = [
    ...getProjectValidators,
    body("threshold").isFloat({ min: -60, max: -10 }).withMessage("threshold must be between -60 and -10 dB"),
    body("minDuration").isFloat({ min: 0.1, max: 10 }).withMessage("minDuration must be between 0.1 and 10 seconds"),
    body("padding").isFloat({ min: 0, max: 1 }).withMessage("padding must be between 0 and 1 second"),
    validateErrors
];

export {
    createProjectValidators,
    getProjectValidators,
    renameProjectValidators,
    updateClipCountValidators,
    detectSilenceValidators
};

