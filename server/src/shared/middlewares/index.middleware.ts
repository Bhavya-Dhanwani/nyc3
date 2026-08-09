// Importing modules
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "../config/env.config.js";
import passport, { setupPassport } from "../config/passport.config.js";

// function to apply middlewares to the app
function applyMiddlewares(app) {

    // to enable CORS with credentials (required for the httpOnly refresh token cookie)
    app.use(cors({
        origin: env.FRONTEND_URL || true,
        credentials: true
    }));

    // to parse cookies (required for the httpOnly refresh token)
    app.use(cookieParser());

    app.use(express.json({ limit: "50mb" })); // to parse incoming requests with JSON payloads

    app.use(express.urlencoded({ extended: true, limit: "50mb" })); // to parse incoming requests with URL-encoded payloads

    // initialize passport
    setupPassport();
    app.use(passport.initialize());

}

export default applyMiddlewares;
