// Importing modules
import pino from "pino";
import env from "./env.config.js";

// Check if pino-pretty is installed and available
let hasPinoPretty = false;
try {
    await import("pino-pretty");
    hasPinoPretty = true;
} catch {
    // pino-pretty is not installed or not available
}

// creating a logger instance
const logger = pino({

    level: env.NODE_ENV === "production" ? "info" : "debug",

    ...(hasPinoPretty && env.NODE_ENV !== "production" && {
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        },
    }),

});

export default logger;
