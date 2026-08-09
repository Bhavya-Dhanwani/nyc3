// Importing modules
import mongoose from "mongoose";
import env from "./env.config.js";
import logger from "./logger.config.js";

// function to connect to the database
async function connectDB() {

    try {

        // connecting to the database
        await mongoose.connect(env.MONGO_URI);
        logger.info("Connected to the database");

    }
    catch (error: any) {

        // logging the error
        logger.error(error, "Error connecting to the database:");

    }

}

export default connectDB;
