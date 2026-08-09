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

export { googleLoginValidators };

