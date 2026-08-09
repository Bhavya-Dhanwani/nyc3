// Importing modules
import logger from "../config/logger.config.js";

// function to handle errors in the application
function errorHandler(err, req, res, next) {

    const statusCode = err.statusCode || 500;

    // Only log full stack traces for unexpected 500 server crashes
    if (statusCode >= 500) {
        logger.error(err, `Server Error on ${req.method} ${req.originalUrl}`);
    } else if (statusCode !== 401 && statusCode !== 404) {
        // Log client errors (400, 403, 409) cleanly as warnings without stack traces
        logger.warn(`Client Error [${statusCode}] on ${req.method} ${req.originalUrl}: ${err.message}`);
    }

    // sending the error response with the status code and message
    return res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: err.message || "Internal Server Error"
    });

}

export default errorHandler;
