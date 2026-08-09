// Importing modules
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import BadRequest from "../errors/BadRequest.error.js";

// defining allowed media formats
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".mp3", ".wav", ".m4a"];

// setting up multer storage configuration
const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        const uploadDir = "./uploads";

        // ensuring upload directory exists
        if (!fs.existsSync(uploadDir)) {

            fs.mkdirSync(uploadDir, { recursive: true });

        }

        cb(null, uploadDir);

    },

    filename: function (req, file, cb) {

        // creating a unique filename
        const ext = path.extname(file.originalname);
        const name = `${uuidv4()}${ext}`;
        cb(null, name);

    }

});

// setting up file filter to validate extensions
const fileFilter = (req, file, cb) => {

    const ext = path.extname(file.originalname).toLowerCase();

    // checking if extension is supported
    if (!ALLOWED_EXTENSIONS.includes(ext)) {

        return cb(new BadRequest(`Unsupported file type ${ext}. Use mp4, mov, mp3, wav, or m4a.`), false);

    }

    cb(null, true);

};

// creating the upload middleware instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 500 // 500MB size limit
    }
});

export default upload;
