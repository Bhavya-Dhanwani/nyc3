// Importing modules
import createApp from "./src/app.js";
import connectDB from "./src/shared/config/db.config.js";
import logger from "./src/shared/config/logger.config.js";
import env from "./src/shared/config/env.config.js";

// function to start the express server
async function startServer() {

    const app = createApp();

    // connecting to the MongoDB database
    await connectDB();

    // listening to request port
    const server = app.listen(env.PORT, () => {
        logger.info(`Server is running on port ${env.PORT}`);
    });

    // Graceful shutdown handler for Docker SIGTERM / SIGINT
    const handleShutdown = async (signal: string) => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);

        server.close(async () => {
            logger.info("HTTP server closed.");

            try {
                const mongoose = (await import("mongoose")).default;
                await mongoose.connection.close();
                logger.info("MongoDB connection closed.");
            } catch (err: any) {
                logger.warn(`Error during MongoDB disconnect: ${err.message}`);
            }

            process.exit(0);
        });

        // Force shutdown if connections do not close in time
        setTimeout(() => {
            logger.error("Forcefully terminating process due to shutdown timeout.");
            process.exit(1);
        }, 10000).unref();
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

}

startServer();
