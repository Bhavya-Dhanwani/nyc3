import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import env from "./env.config.js";
import UserDao from "../dao/user.dao.js";
import logger from "./logger.config.js";

const userDao = new UserDao();

export function setupPassport() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        logger.warn("Passport: Google Client ID or Secret is missing in environment variables. Google OAuth will be disabled.");
        return;
    }

    passport.use(
        new GoogleStrategy(
            {
                clientID: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
                callbackURL: env.GOOGLE_REDIRECT_URI,
                passReqToCallback: true,
                scope: [
                    "profile",
                    "email",
                    "https://www.googleapis.com/auth/drive",
                    "https://www.googleapis.com/auth/drive.file"
                ]
            },
            async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error("No email found in Google profile"), undefined);
                    }

                    let user = await userDao.findUserByEmail(email);

                    const updateData: any = {
                        googleAccessToken: accessToken,
                        googleTokenExpiry: new Date(Date.now() + 3600 * 1000), // standard 1hr expiry
                    };

                    if (refreshToken) {
                        updateData.googleRefreshToken = refreshToken;
                    }

                    if (user) {
                        const additions: any = { ...updateData };
                        if (!user.providers.includes("google")) {
                            additions.$addToSet = { providers: "google" };
                            additions.googleId = profile.id;
                            additions.isVerified = true;
                        }
                        user = await userDao.updateUserById(user._id.toString(), additions);
                    } else {
                        user = await userDao.createUser({
                            name: profile.displayName || email.split("@")[0],
                            email: email,
                            providers: ["google"],
                            googleId: profile.id,
                            isVerified: true,
                            ...updateData
                        });
                    }

                    return done(null, user);
                } catch (err: any) {
                    logger.error(`Passport Google Strategy Error: ${err.message}`);
                    return done(err, undefined);
                }
            }
        )
    );

    passport.serializeUser((user: any, done) => {
        done(null, user._id || user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await userDao.findUserById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });

    logger.info("Passport: Google OAuth & Drive Strategy initialized successfully.");
}

export default passport;
