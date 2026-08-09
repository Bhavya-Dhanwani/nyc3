// Importing modules
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import env from "../config/env.config.js";
import Unauthorized from "../errors/Unauthorized.error.js";

// function to get the refresh token from the cookie and verify it
function refreshMiddleware(req: Request & { session?: Record<string, unknown>; refreshToken?: string }, res: Response, next: NextFunction) {

    // getting the refresh token from the cookie
    const refreshToken = req.cookies?.refreshToken;

    // if the refresh token is not present, throw an unauthorized error
    if (!refreshToken) {
        throw new Unauthorized("Refresh token not found in cookie.");
    }

    try {

        // verifying the refresh token
        const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET);

        // attach the decoded session to the request object
        req.session = decoded as Record<string, unknown>;

    } catch (error) {

        // if the refresh token is invalid, return an error
        throw new Unauthorized("Refresh token expired or invalid.");

    }

    // attach the raw refresh token string to the request
    req.refreshToken = refreshToken;

    next();

}

export default refreshMiddleware;
