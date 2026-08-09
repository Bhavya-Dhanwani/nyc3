// Function to send API response
function ApiResponse(res, statusCode, message, data = null) {

    // sending the response
    res.status(statusCode).json({
        success: true,
        status: statusCode,
        message: message,
        data: data
    });

}

export default ApiResponse;
