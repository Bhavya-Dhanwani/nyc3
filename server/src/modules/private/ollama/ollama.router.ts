// Importing modules
import express from "express";
import OllamaController from "./ollama.controller.js";

// making the router
const router = express.Router();

// creating an ollama controller instance
const controller = new OllamaController();

/*
    @route POST /api/ollama/pull
    @desc Pull local LLM model from Ollama library and stream progress
    @access Private
*/
router.post("/pull", controller.pullModel);

/*
    @route POST /api/ollama/install
    @desc Retrieve instructions to set up Ollama locally
    @access Private
*/
router.post("/install", controller.installOllama);

// exporting the router
export default router;
