// Importing modules
import mongoose from "mongoose";
import SessionDao from "../dao/session.dao.js";
import { Response } from "express";
import { generateAccessToken, generateRefreshToken } from "./token.util.js";
import buildTokenPayload from "./buildTokenPayload.util.js";
import env from "../config/env.config.js";

// cookie expiry: 7 days in ms
const COOKIE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000;

const REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    maxAge: COOKIE_EXPIRY_TIME,
};

// function to create a session and return sanitized user with tokens
async function createSession(user: Record<string, unknown> | object, res: Response) {

    const u = (user as { _id: { toString(): string } });
    const tokenPayload = await buildTokenPayload(user);
    const sessionId = new mongoose.Types.ObjectId();

    const refreshToken = generateRefreshToken({
        sessionId: sessionId.toString(),
        userId: u._id.toString()
    });

    const sDao = new SessionDao();

    await sDao.createSession({
        _id: sessionId,
        userId: u._id,
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + COOKIE_EXPIRY_TIME)
    });

    const accessToken = generateAccessToken(tokenPayload);

    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return { sanitizedUser: tokenPayload, accessToken };

}

export default createSession;
