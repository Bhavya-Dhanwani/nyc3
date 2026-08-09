// Importing modules
import { body } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";

const googleLoginValidators = [

    // validating the credential field
    body("credential")
        .notEmpty().withMessage("Google credential is required"),

    // validating errors
    validateErrors

];

const signupValidators = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),

    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email address")
        .normalizeEmail(),

    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

    validateErrors
];

const loginValidators = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email address")
        .normalizeEmail(),

    body("password")
        .notEmpty().withMessage("Password is required"),

    validateErrors
];

export { googleLoginValidators, signupValidators, loginValidators };

