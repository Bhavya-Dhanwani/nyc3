// Importing modules
import { Request } from "express";

// User payload interface
export interface IUserPayload {
    _id?: string;
    userId?: string;
    name?: string;
    email?: string;
    isVerified?: boolean;
}

// Session payload interface
export interface ISessionPayload {
    sessionId: string;
    userId: string;
}

// Authenticated request interface (used by protected routes)
export interface AuthenticatedRequest extends Request {
    user?: IUserPayload;
}

// Session request interface (used by refresh/logout routes)
export interface SessionRequest extends Request {
    session?: ISessionPayload;
    refreshToken?: string;
}

// Google login request body interface
export interface GoogleLoginRequestBody {
    credential: string;
}

export type GoogleLoginRequest = Request<Record<string, string>, unknown, GoogleLoginRequestBody>;

