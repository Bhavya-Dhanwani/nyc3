import { google } from "googleapis";
import env from "../config/env.config.js";
import BadRequest from "../errors/BadRequest.error.js";

// factory so every call gets a fresh OAuth2 client with current env
const createGoogleOAuthClient = () => new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
);

// generate the Google OAuth authorization URL
function getGoogleAuthorizationUrl(state: string) {
    return createGoogleOAuthClient().generateAuthUrl({
        access_type: "offline",
        scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/drive.file"
        ],
        prompt: "consent",
        state,
    });
}

// exchange authorization code for user profile data
async function getGoogleUserFromCode(code: string) {
    try {
        const oauth2Client = createGoogleOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const { data } = await google.oauth2("v2").userinfo.get({ auth: oauth2Client });
        if (!data.id || !data.email || !data.verified_email) {
            throw new Error("Google account email is not verified");
        }
        return {
            googleId: data.id,
            email: data.email,
            name: data.name || data.email.split("@")[0],
            picture: data.picture,
            tokens, // return the full credential set including access/refresh tokens
        };
    } catch (err: any) {
        throw new BadRequest(`Google sign-in could not be completed: ${err.message}`);
    }
}

// verify a Google one-tap credential token
async function verifyGoogleToken(credential: string) {
    try {
        const ticket = await createGoogleOAuthClient().verifyIdToken({
            idToken: credential,
            audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.email_verified) throw new Error("Unverified email");
        return { googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
    } catch {
        throw new BadRequest("Invalid Google credentials");
    }
}

export { getGoogleAuthorizationUrl, getGoogleUserFromCode, verifyGoogleToken };
