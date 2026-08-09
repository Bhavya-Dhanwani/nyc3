// Importing modules
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./shared/routers/index.router.js";
import applyMiddlewares from "./shared/middlewares/index.middleware.js";
import notFoundHandler from "./shared/middlewares/NotFound.middleware.js";
import errorHandler from "./shared/middlewares/error.middleware.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = [
    // Production images run from /app, where the Dockerfile copies the client build.
    path.resolve(process.cwd(), "public"),
    // Local development runs this file from server/src.
    path.resolve(moduleDirectory, "..", "public"),
    // Compiled local builds run it from server/dist/src.
    path.resolve(moduleDirectory, "..", "..", "public")
].find((directory) => existsSync(path.join(directory, "index.html")));

// function to make the app
function createApp() {

    // create an express app
    const app = express();

    // applying middlewares
    applyMiddlewares(app);

    // lightweight healthcheck endpoint for Docker container and load balancers
    app.get(["/health", "/api/health"], (req, res) => {
        res.status(200).json({
            status: "ok",
            service: "autoshorts-api",
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    // serve uploaded files and rendered clips statically with cross-origin resource sharing support
    app.use("/uploads", (req, res, next) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Content-Type, Accept");
        res.setHeader("Accept-Ranges", "bytes");
        if (req.method === "OPTIONS") {
            return res.sendStatus(204);
        }
        next();
    }, express.static("./uploads", {
        dotfiles: "ignore",
        etag: true,
        lastModified: true,
        maxAge: "1d"
    }));

    // adding the index router to the app
    app.use("/api", router);

    // API routes must continue returning JSON 404 responses instead of the SPA shell.
    app.use("/api", notFoundHandler);

    // Serve a built frontend copied into server/public, when present.
    if (publicDirectory) {

        app.use(express.static(publicDirectory));

        // Express 5 requires a named wildcard. This lets client-side routes reload correctly.
        app.get("/*path", (req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

    }

    // not found middleware
    app.use(notFoundHandler);

    // error handling middleware
    app.use(errorHandler);

    // returning the app
    return app;

}

export default createApp;
