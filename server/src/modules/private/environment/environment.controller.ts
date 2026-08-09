// Importing modules
import axios from "axios";
import env from "../../../shared/config/env.config.js";
import logger from "../../../shared/config/logger.config.js";
import MediaService from "../../../shared/services/media.service.js";
import UserDao from "../../../shared/dao/user.dao.js";
import Ok from "../../../shared/responses/Ok.response.js";
import { exec } from "child_process";
import { Request, Response } from "express";

// class to handle environment checking operations
class EnvironmentController {

    mediaService: MediaService;
    userDao: UserDao;

    constructor() {

        // initializing the media service
        this.mediaService = new MediaService();
        this.userDao = new UserDao();

    }

    // get environment status metrics
    getEnvironmentStatus = async (req: Request, res: Response) => {

        // checking if ffmpeg and ffprobe are installed
        const hasFfmpeg = await this.mediaService.commandExists("ffmpeg");
        const hasFfprobe = await this.mediaService.commandExists("ffprobe");


        // checking if whisper command line utility is installed on the server
        let hasLocalWhisperModel = false;

        try {

            await new Promise<void>((resolve, reject) => {

                exec("whisper --help", (err) => {

                    if (err) {

                        reject(err);

                    }
                    else {

                        resolve();

                    }

                });

            });

            hasLocalWhisperModel = true;

        }
        catch {

            // local whisper CLI is optional
            hasLocalWhisperModel = false;

        }

        // checking if ollama is accessible
        let hasOllama = false;

        try {

            const response = await axios.get(env.OLLAMA_HOST, { timeout: 800 });
            hasOllama = response.status === 200;

        }
        catch {

            // Ollama is optional, quietly set to false
            hasOllama = false;

        }

        const userId = (req as any).user?.userId;
        const user = userId ? await this.userDao.findUserById(userId) : null;
        const uDoc = user as any;

        const status = {
            dataDir: "./uploads",
            hasFfmpeg,
            hasFfprobe,
            hasDeepgramKey: !!(uDoc?.deepgramKeys?.length || process.env.DEEPGRAM_API_KEY),
            hasAnthropicKey: !!(uDoc?.anthropicKeys?.length || process.env.ANTHROPIC_API_KEY),
            hasDeepseekKey: !!(uDoc?.deepseekKeys?.length || process.env.DEEPSEEK_API_KEY),
            hasGeminiKey: !!(uDoc?.geminiKeys?.length || process.env.GEMINI_API_KEY),
            hasOpenaiKey: !!(uDoc?.openaiKeys?.length || process.env.OPENAI_API_KEY),
            hasOpenrouterKey: !!(uDoc?.openrouterKeys?.length || process.env.OPENROUTER_API_KEY),
            hasGroqKey: !!(uDoc?.groqKeys?.length || process.env.GROQ_API_KEY),
            hasMistralKey: !!(uDoc?.mistralKeys?.length || process.env.MISTRAL_API_KEY || process.env.MIXTRAL_API_KEY),
            llmProvider: env.LLM_PROVIDER,
            hasLocalWhisperModel,
            hasOllama,
            hasCloudinary: false
        };

        return Ok(res, "Environment status retrieved successfully", status);

    }

}

export default EnvironmentController;
