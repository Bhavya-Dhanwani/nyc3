// Importing modules
import { param } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";
import mongoose from "mongoose";

const cutCandidateValidators = [

    // validating candidateId
    param("candidateId")
        .notEmpty()
        .withMessage("Candidate ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Candidate ID"),

    validateErrors

];

const cutSelectedValidators = [

    // validating projectId
    param("projectId")
        .notEmpty()
        .withMessage("Project ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Project ID"),

    validateErrors

];

export {
    cutCandidateValidators,
    cutSelectedValidators
};
