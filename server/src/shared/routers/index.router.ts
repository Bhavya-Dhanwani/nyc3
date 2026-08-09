// Importing modules
import express from "express";
import authRouter from "../../modules/public/auth/auth.router.js";
import projectsRouter from "../../modules/private/projects/projects.router.js";
import candidatesRouter from "../../modules/private/candidates/candidates.router.js";
import environmentRouter from "../../modules/private/environment/environment.router.js";
import ollamaRouter from "../../modules/private/ollama/ollama.router.js";
import authMiddleware from "../middlewares/auth.middleware.js";

// making the router
const router = express.Router();

// public routes
router.use("/auth", authRouter);

// private routes protected by authentication middleware
router.use("/projects", authMiddleware, projectsRouter);
router.use("/candidates", authMiddleware, candidatesRouter);
router.use("/environment", authMiddleware, environmentRouter);
router.use("/ollama", authMiddleware, ollamaRouter);


// exporting the router
export default router;


