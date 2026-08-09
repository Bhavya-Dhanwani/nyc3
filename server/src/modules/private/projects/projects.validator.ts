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
        .optional()
        .isString()
        .withMessage("Caption style must be a string"),

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

export {
    createProjectValidators,
    getProjectValidators,
    renameProjectValidators,
    updateClipCountValidators
};
