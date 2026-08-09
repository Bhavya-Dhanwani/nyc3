// Importing modules
import { Request, Response } from "express";
import { AuthenticatedRequest, SessionRequest, GoogleLoginRequest } from "./auth.types.js";
import env from "../../../shared/config/env.config.js";
import UserDao from "../../../shared/dao/user.dao.js";
import SessionDao from "../../../shared/dao/session.dao.js";
import TokenDao from "../../../shared/dao/token.dao.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import Unauthorized from "../../../shared/errors/Unauthorized.error.js";
import Ok from "../../../shared/responses/Ok.response.js";
import createSession from "../../../shared/utils/createSession.util.js";
import { getGoogleAuthorizationUrl, getGoogleUserFromCode, verifyGoogleToken } from "../../../shared/utils/googleAuth.util.js";
import { generateResetPasswordToken } from "../../../shared/utils/token.util.js";

// class to handle public authentication operations
class AuthController {

    userDao: UserDao;
    sessionDao: SessionDao;
    tokenDao: TokenDao;

    constructor() {

        // initializing the DAOs
        this.userDao = new UserDao();
        this.sessionDao = new SessionDao();
        this.tokenDao = new TokenDao();

    }

    // get authenticated user profile
    me = async (req: AuthenticatedRequest, res: Response) => {

        const userId = req.user?.userId;
        const user = await this.userDao.findUserById(userId);
        if (!user) {
            throw new NotFound("User not found");
        }
        const userJson = user.toJSON();
        delete userJson.password;

        // returning the authenticated user profile
        return Ok(res, "User profile fetched successfully", { user: userJson });

    };

    // refresh access token using the refresh token cookie
    refresh = async (req: SessionRequest, res: Response) => {

        const { session, refreshToken } = req;

        if (!session || !refreshToken) {
            throw new Unauthorized("Session expired or invalid");
        }

        const sessionId = (session as unknown as Record<string, unknown>).sessionId as string;

        // finding the session in the database
        const dbSession = await this.sessionDao.findSessionByRefreshTokenandSessionId(refreshToken, sessionId);

        if (!dbSession) {
            throw new Unauthorized("Session expired or invalid");
        }

        // getting the user from the session (userId is populated as a full user document)
        const populatedUser = (dbSession as any).userId;
        const dbUserId = typeof populatedUser === "object" && populatedUser?._id
            ? populatedUser._id.toString()
            : String(populatedUser || "");
        const user = await this.userDao.findUserById(dbUserId);

        if (!user) {
            throw new Unauthorized("Session expired or invalid");
        }

        // creating new session and tokens
        const { sanitizedUser, accessToken } = await createSession(user, res);

        // deleting the old session (token rotation)
        await this.sessionDao.deleteSessionByRefreshTokenandSessionId(refreshToken, sessionId);

        return Ok(res, "Token refreshed successfully", {
            user: sanitizedUser,
            accessToken: accessToken,
        });

    };

    // logout user (current session only)
    logout = async (req: SessionRequest, res: Response) => {

        const { session, refreshToken } = req;

        if (refreshToken && session) {
            await this.sessionDao.deleteSessionByRefreshTokenandSessionId(refreshToken, session.sessionId);
        }

        res.clearCookie("refreshToken");

        return Ok(res, "Logged out successfully");

    };

    // logout user from all active sessions
    logoutAll = async (req: AuthenticatedRequest, res: Response) => {

        const userId = (req.user?._id || req.user?.userId) as string;

        await this.sessionDao.deleteSessionByUserId(userId);

        res.clearCookie("refreshToken");

        return Ok(res, "Logged out from all sessions successfully");

    };

    // login via google credential token (one-tap / button)
    googleLogin = async (req: GoogleLoginRequest, res: Response) => {

        const { credential } = req.body;

        const googleUser = await verifyGoogleToken(credential);

        let user = await this.userDao.findUserByEmail(googleUser.email);

        if (user) {

            if (!user.providers.includes("google")) {

                user = await this.userDao.updateUserById(user._id.toString(), {
                    $addToSet: { providers: "google" },
                    googleId: googleUser.googleId,
                });

            }

        } else {

            user = await this.userDao.createUser({
                name: googleUser.name,
                email: googleUser.email,
                providers: ["google"],
                googleId: googleUser.googleId,
                isVerified: true,
            });

        }

        const { sanitizedUser, accessToken } = await createSession(user!, res);

        return Ok(res, "Logged in via Google successfully", {
            user: sanitizedUser,
            accessToken: accessToken,
        });

    };

    // redirect to google oauth authorization page
    googleRedirect = (req: Request, res: Response) => {
        try {
            const state = generateResetPasswordToken(32);

            res.cookie("googleOAuthState", state, {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 10 * 60 * 1000,
            });

            let clientOrigin = env.FRONTEND_URL || "http://localhost:5173";

            if (req.headers.referer) {
                try {
                    clientOrigin = new URL(req.headers.referer).origin;
                } catch {
                    // ignore invalid URL referers
                }
            }

            res.cookie("googleOAuthOrigin", clientOrigin, {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 10 * 60 * 1000,
            });

            const authUrl = getGoogleAuthorizationUrl(state);
            return res.redirect(authUrl);
        } catch (err: any) {
            return res.redirect(`${env.FRONTEND_URL}/?googleError=1`);
        }
    };

    // handle google oauth callback
    googleCallback = async (req: Request, res: Response) => {
        const cookies = (req.cookies as Record<string, string>);
        const clientOrigin = cookies?.googleOAuthOrigin || env.FRONTEND_URL || "http://localhost:5173";
        const redirectToLogin = `${clientOrigin}/?googleError=1`;

        try {
            const { code, state, error } = req.query;

            const isStateValid = state && state === cookies?.googleOAuthState;

            if (error || !code || (!isStateValid && env.NODE_ENV === "production")) {
                res.clearCookie("googleOAuthState");
                res.clearCookie("googleOAuthOrigin");
                return res.redirect(redirectToLogin);
            }

            res.clearCookie("googleOAuthState");
            res.clearCookie("googleOAuthOrigin");

            const googleUser = await getGoogleUserFromCode(code as string);
            let user = await this.userDao.findUserByEmail(googleUser.email);

            const updateData: any = {
                googleAccessToken: googleUser.tokens?.access_token || undefined,
                googleTokenExpiry: googleUser.tokens?.expiry_date ? new Date(googleUser.tokens.expiry_date) : undefined,
            };

            if (googleUser.tokens?.refresh_token) {
                updateData.googleRefreshToken = googleUser.tokens.refresh_token;
            }

            if (user) {
                const additions: any = { ...updateData };
                if (!user.providers.includes("google")) {
                    additions.$addToSet = { providers: "google" };
                    additions.googleId = googleUser.googleId;
                    additions.isVerified = true;
                }
                user = await this.userDao.updateUserById(user._id.toString(), additions);
            } else if (!user) {
                user = await this.userDao.createUser({
                    name: googleUser.name,
                    email: googleUser.email,
                    providers: ["google"],
                    googleId: googleUser.googleId,
                    isVerified: true,
                    ...updateData
                });
            }

            const session = await createSession(user!, res);

            // returning redirect to dashboard with token
            return res.redirect(`${clientOrigin}/?token=${session.accessToken}&googleSuccess=1`);
        } catch (err) {
            return res.redirect(redirectToLogin);
        }
    };

    // handle passport google oauth success
    handlePassportGoogleSuccess = async (req: any, res: Response) => {
        try {
            const user = req.user;
            if (!user) {
                return res.redirect(`${env.FRONTEND_URL}/?googleError=1`);
            }

            const session = await createSession(user, res);
            const redirectUrl = `${env.FRONTEND_URL}/?token=${session.accessToken}&googleSuccess=1`;
            return res.redirect(redirectUrl);
        } catch (err) {
            return res.redirect(`${env.FRONTEND_URL}/?googleError=1`);
        }
    };

    // update user personal API keys
    updateKeys = async (req: AuthenticatedRequest, res: Response) => {

        const userId = req.user?.userId || (req.user as any)?._id || (req.user as any)?.id;
        const keys = req.body?.keys || req.body || {};

        const updateData: any = {};
        const allowedKeys = [
            "deepgramKey", "anthropicKey", "deepseekKey", "geminiKey",
            "openaiKey", "openrouterKey", "groqKey", "mistralKey"
        ];

        for (const k of allowedKeys) {
            if (keys[k] !== undefined) {
                if (typeof keys[k] === "string") {
                    const trimmed = keys[k].trim();
                    updateData[k] = trimmed === "" ? null : trimmed;
                } else {
                    updateData[k] = keys[k] || null;
                }
            }
        }

        const user = await this.userDao.updateUserById(userId!, updateData);
        if (!user) throw new NotFound("User not found");

        return Ok(res, "API keys updated successfully");

    };

    // retrieve user personal API keys
    getKeys = async (req: AuthenticatedRequest, res: Response) => {

        const userId = req.user?.userId || (req.user as any)?._id || (req.user as any)?.id;
        const user = await this.userDao.findUserById(userId!);
        if (!user) throw new NotFound("User not found");

        const uDoc = user as any;

        return Ok(res, "API keys retrieved successfully", {
            deepgramKey: uDoc.deepgramKey || "",
            anthropicKey: uDoc.anthropicKey || "",
            deepseekKey: uDoc.deepseekKey || "",
            geminiKey: uDoc.geminiKey || "",
            openaiKey: uDoc.openaiKey || "",
            openrouterKey: uDoc.openrouterKey || "",
            groqKey: uDoc.groqKey || "",
            mistralKey: uDoc.mistralKey || "",
        });

    };

}

export default AuthController;


