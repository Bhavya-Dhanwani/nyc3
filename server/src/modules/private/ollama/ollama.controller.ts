// Importing modules
import axios from "axios";
import env from "../../../shared/config/env.config.js";
import logger from "../../../shared/config/logger.config.js";
import Ok from "../../../shared/responses/Ok.response.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import { Request, Response } from "express";

// class to handle Ollama local model operations
class OllamaController {

    // pull an Ollama model and stream progress to client using Server-Sent Events
    pullModel = async (req: Request, res: Response) => {

        const { modelName } = req.body;

        if (!modelName) {

            throw new BadRequest("Model name is required");

        }

        // setting headers for server-sent events stream
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {

            const url = `${env.OLLAMA_HOST}/api/pull`;

            // posting pull request to host Ollama server and receiving stream
            const response = await axios.post(url, {
                name: modelName,
                stream: true
            }, {
                responseType: "stream"
            });

            // piping raw stream data to Express response using Event-Stream format
            response.data.on("data", (chunk) => {

                const lines = chunk.toString().split("\n").filter(l => l.trim().length > 0);

                for (const line of lines) {

                    res.write(`data: ${line}\n\n`);

                }

            });

            response.data.on("end", () => {

                res.write('data: {"status": "success", "completed": true}\n\n');
                res.end();

            });

            response.data.on("error", (err) => {

                logger.error(`Ollama stream error: ${err.message}`);
                res.write(`data: {"error": "${err.message}"}\n\n`);
                res.end();

            });

        }
        catch (err) {

            logger.error(`failed to connect to Ollama at ${env.OLLAMA_HOST}: ${err.message}`);
            res.write(`data: {"error": "Failed to connect to local Ollama server at ${env.OLLAMA_HOST}"}\n\n`);
            res.end();

        }

    }

    // install Ollama placeholder returning setup guidelines
    installOllama = async (req: Request, res: Response) => {

        const instructions = {
            platform: process.platform,
            message: "Ollama must be installed and running on your host machine.",
            guidelines: [
                "1. Download Ollama from the official website: https://ollama.com",
                "2. Launch Ollama app on your host machine",
                "3. Ensure Ollama is listening on http://localhost:11434 (default)",
                "4. Docker container connects via host.docker.internal gateway"
            ]
        };

        return Ok(res, "Ollama installation guidelines", instructions);

    }

}

export default OllamaController;
