// Importing modules
import express from "express";
import EnvironmentController from "./environment.controller.js";

// making the router
const router = express.Router();

// creating an environment controller instance
const controller = new EnvironmentController();

/*
    @route GET /api/environment/status
    @desc Get system dependency status (FFmpeg, Ollama, API keys)
    @access Private
*/
router.get("/status", controller.getEnvironmentStatus);

// exporting the router
export default router;
