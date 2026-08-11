// Importing modules
import express from "express";
import CandidatesController from "./candidates.controller.js";
import { cutCandidateValidators, cutSelectedValidators } from "./candidates.validator.js";

// making the router
const router = express.Router();

// creating a candidates controller instance
const controller = new CandidatesController();

/*
    @route POST /api/candidates/:candidateId/cut
    @desc Render vertical video clip for a single candidate
    @access Private
*/
router.post("/:candidateId/cut", cutCandidateValidators, controller.cutCandidate);

/*
    @route POST /api/candidates/projects/:projectId/cut-selected
    @desc sequentially render all selected candidate vertical clips for a project
    @access Private
*/
router.post("/projects/:projectId", cutSelectedValidators, controller.cutSelected);

/*
    @route PUT /api/candidates/:candidateId/layout
    @desc Save layout configuration for a single candidate
    @access Private
*/
router.put("/:candidateId/layout", controller.updateLayout);

/*
    @route GET /api/candidates/:candidateId/capcut
    @desc Export candidate clip project as CapCut desktop draft ZIP
    @access Private
*/
router.get("/:candidateId/capcut", controller.exportCapcutDraft);

/*
    @route GET /api/candidates/:candidateId/download
    @desc Direct download of rendered 9:16 Short MP4 video
    @access Private
*/
router.get("/:candidateId/download", controller.downloadCandidateClip);

/*
    @route PUT /api/candidates/:candidateId/review-status
    @desc Update candidate human review state (approved, rejected, etc)
    @access Private
*/
router.put("/:candidateId/review-status", controller.updateReviewStatus);

/*
    @route POST /api/candidates/:candidateId/generate-hooks
    @desc Generate 5 distinct hook options on demand
    @access Private
*/
router.post("/:candidateId/generate-hooks", controller.generateHooks);

/*
    @route POST /api/candidates/:candidateId/generate-titles
    @desc Generate style-specific title options on demand
    @access Private
*/
router.post("/:candidateId/generate-titles", controller.generateTitles);

/*
    @route POST /api/candidates/:candidateId/generate-social
    @desc Generate platform-specific social post copy
    @access Private
*/
router.post("/:candidateId/generate-social", controller.generateSocial);

/*
    @route POST /api/candidates/:candidateId/edit-plan
    @desc Generate structured AI edit plan
    @access Private
*/
router.post("/:candidateId/edit-plan", controller.generateEditPlan);

// exporting the router
export default router;
