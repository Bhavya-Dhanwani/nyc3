// Importing modules
import NotFound from "../errors/NotFound.error.js";

// function to handle 404 routes
function notFoundHandler(req, res, next) {

    // throwing a NotFound error
    throw new NotFound("Resource not found");

}

export default notFoundHandler;
