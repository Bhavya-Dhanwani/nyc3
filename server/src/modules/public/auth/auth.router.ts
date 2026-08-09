// Importing modules
import express from "express";
import AuthController from "./auth.controller.js";
import { signupValidators, loginValidators, forgotPasswordValidators, resetPasswordValidators, googleLoginValidators } from "./auth.validator.js";
import authMiddleware from "../../../shared/middlewares/auth.middleware.js";
import refreshMiddleware from "../../../shared/middlewares/refresh.middleware.js";

// making the router
const router = express.Router();

// creating a auth controller instance
const authController = new AuthController();

/*
    @route POST /api/auth/signup (and /register)
    @desc Signup user with email + password
    @access Public
*/
router.post("/signup", signupValidators, authController.signup);
router.post("/register", signupValidators, authController.signup);

/*
    @route POST /api/auth/login
    @desc Login user with email + password
    @access Public
*/
router.post("/login", loginValidators, authController.login);

/*
    @route GET /api/auth/me
    @desc Get authenticated user profile
    @access Private
*/
router.get("/me", authMiddleware, authController.me);

/*
    @route POST /api/auth/refresh
    @desc Refresh access token using the httpOnly refresh token cookie
    @access Public
*/
router.post("/refresh", refreshMiddleware, authController.refresh);

/*
    @route POST /api/auth/logout
    @desc Logout from current session
    @access Public
*/
router.post("/logout", refreshMiddleware, authController.logout);

/*
    @route POST /api/auth/logoutall
    @desc Logout from all active sessions
    @access Private
*/
router.post("/logoutall", authMiddleware, authController.logoutAll);

/*
    @route POST /api/auth/google-login
    @desc Login via Google one-tap credential token
    @access Public
*/
router.post("/google-login", googleLoginValidators, authController.googleLogin);

/*
    @route GET /api/auth/google
    @desc Redirect to Google OAuth consent screen with Drive permissions via Passport
    @access Public
*/
router.get("/google", authController.googleRedirect);

/*
    @route GET /api/auth/google/callback
    @desc Handle Google OAuth callback
    @access Public
*/
router.get("/google/callback", authController.googleCallback);

/*
    @route POST /api/auth/forgot-password
    @desc Send password reset email
    @access Public
*/
router.post("/forgot-password", forgotPasswordValidators, authController.forgotPassword);

/*
    @route POST /api/auth/reset-password
    @desc Reset password using token
    @access Public
*/
router.post("/reset-password", resetPasswordValidators, authController.resetPassword);

/*
    @route PUT /api/auth/keys
    @desc Update user personal API keys
    @access Private
*/
router.put("/keys", authMiddleware, authController.updateKeys);

/*
    @route GET /api/auth/keys
    @desc Get masked user personal API keys
    @access Private
*/
router.get("/keys", authMiddleware, authController.getKeys);

// exporting the router
export default router;
