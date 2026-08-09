// Importing modules
import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import logger from "../config/logger.config.js";

// class to handle audio transcription services
class TranscriptionService {

    // function to transcribe audio using Deepgram cloud API
    async transcribeDeepgram(audioPath, apiKey) {

        // reading audio file binary data
        const audioBytes = fs.readFileSync(audioPath);

        const url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&filler_words=true";

        // sending post request to Deepgram API
        const response = await axios.post(url, audioBytes, {
            headers: {
                "Authorization": `Token ${apiKey}`,
                "Content-Type": "audio/wav"
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // normalizing response data
        return this.normalizeDeepgram(response.data);

    }

    // function to normalize deepgram json response
    normalizeDeepgram(data) {

        const alternative = data.results?.channels?.[0]?.alternatives?.[0];

        if (!alternative) {

            throw new Error("Deepgram response did not include alternative transcript");

        }

        const language = data.metadata?.language || "en";
        const duration = data.metadata?.duration || 0.0;
        const rawWords = alternative.words || [];

        const speakers = new Set();
        const words = [];

        for (const w of rawWords) {

            const text = w.punctuated_word || w.word;

            if (!text || text.trim().length === 0) {

                continue;

            }

            const speakerNum = w.speaker !== undefined ? w.speaker + 1 : 1;
            const speaker = `S${speakerNum}`;
            speakers.add(speaker);

            words.push({
                text: text.trim(),
                start: w.start || 0.0,
                end: w.end || 0.0,
                speaker
            });

        }

        // building segments from words
        const segments = this.buildSegments(words);

        return {
            language,
            duration,
            speakers: Array.from(speakers),
            words,
            segments
        };

    }

    // function to group words into speaker segments
    buildSegments(words) {

        const segments = [];
        let current = null;

        for (const word of words) {

            let shouldBreak = false;

            if (current) {

                const pause = word.start - current.end;
                const speakerChanged = current.speaker !== word.speaker;
                const sentenceEnd = /[.!?]$/.test(current.text);

                // break condition: pause > 0.9s or speaker changed or sentence ended
                shouldBreak = pause > 0.9 || speakerChanged || sentenceEnd;

            }

            if (shouldBreak) {

                if (current) {

                    segments.push(current);

                }

                current = null;

            }

            if (current) {

                current.end = word.end;
                current.text = `${current.text} ${word.text}`;

            }
            else {

                current = {
                    start: word.start,
                    end: word.end,
                    speaker: word.speaker,
                    text: word.text
                };

            }

        }

        if (current) {

            segments.push(current);

        }

        return segments;

    }

    // function to transcribe audio using Groq Whisper API (whisper-large-v3, ultra fast)
    async transcribeGroq(
        audioPath: string,
        apiKey: string,
        onProgress?: (msg: string, percent: number) => Promise<void> | void,
        language = "hinglish"
    ): Promise<any> {
        const stats = fs.statSync(audioPath);
        const MAX_SIZE = 22 * 1024 * 1024; // 22 MB safe threshold for 25MB Groq API limit

        if (stats.size > MAX_SIZE) {
            logger.info(`Audio size (${(stats.size / (1024 * 1024)).toFixed(2)} MB) exceeds 22MB limit. Chunking audio for Groq...`);
            return await this.transcribeInChunks(audioPath, apiKey, "groq", onProgress, language);
        }

        if (onProgress) await onProgress("Transcribing audio with Groq Whisper-Large-v3...", 30);
        return await this.transcribeGroqSingle(audioPath, apiKey, 3, language);
    }

    async transcribeGroqSingle(audioPath: string, apiKey: string, retries = 3, language = "hinglish"): Promise<any> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const audioBytes = fs.readFileSync(audioPath);
                const mimeType = audioPath.endsWith(".mp3") ? "audio/mpeg" : audioPath.endsWith(".m4a") ? "audio/mp4" : "audio/wav";
                const formData = new FormData();
                formData.append("file", new Blob([audioBytes], { type: mimeType }), path.basename(audioPath));
                formData.append("model", "whisper-large-v3");
                formData.append("response_format", "verbose_json");
                formData.append("timestamp_granularities[]", "word");
                formData.append("timestamp_granularities[]", "segment");

                const hinglishPrompt = "Transcribe in Hinglish (Hindi written using English/Latin alphabet, e.g. 'haan bhai kya haal hai, aaj hum baat karenge, yeh bahut accha hai'). Do NOT translate into English, keep exact spoken words in Latin script.";
                if (language === "hinglish") {
                    formData.append("prompt", hinglishPrompt);
                } else if (language === "hi") {
                    formData.append("language", "hi");
                } else if (language === "en") {
                    formData.append("language", "en");
                }

                logger.info(`Transcribing audio via Groq Whisper API (size: ${(audioBytes.length / (1024 * 1024)).toFixed(2)} MB, lang: ${language}, attempt ${attempt}/${retries})...`);

                const response = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", formData, {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    timeout: 120000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                return this.normalizeWhisperJson(response.data);
            } catch (err: any) {
                const status = err.response?.status;
                const errorMsg = err.response?.data?.error?.message || err.message;
                logger.warn(`Groq Whisper attempt ${attempt}/${retries} failed (${status || errorMsg}).`);
                
                if (attempt < retries) {
                    const delayMs = attempt * 2500;
                    logger.info(`Retrying Groq chunk in ${delayMs / 1000}s...`);
                    await new Promise((r) => setTimeout(r, delayMs));
                } else {
                    throw err;
                }
            }
        }
    }

    // function to transcribe audio using OpenAI Whisper API
    async transcribeOpenAI(
        audioPath: string,
        apiKey: string,
        onProgress?: (msg: string, percent: number) => Promise<void> | void,
        language = "hinglish"
    ): Promise<any> {
        const stats = fs.statSync(audioPath);
        const MAX_SIZE = 22 * 1024 * 1024; // 22 MB safe threshold for 25MB OpenAI API limit

        if (stats.size > MAX_SIZE) {
            logger.info(`Audio size (${(stats.size / (1024 * 1024)).toFixed(2)} MB) exceeds 22MB limit. Chunking audio for OpenAI...`);
            return await this.transcribeInChunks(audioPath, apiKey, "openai", onProgress, language);
        }

        if (onProgress) await onProgress("Transcribing audio with OpenAI Whisper...", 30);
        return await this.transcribeOpenAISingle(audioPath, apiKey, 3, language);
    }

    async transcribeOpenAISingle(audioPath: string, apiKey: string, retries = 3, language = "hinglish"): Promise<any> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const audioBytes = fs.readFileSync(audioPath);
                const mimeType = audioPath.endsWith(".mp3") ? "audio/mpeg" : audioPath.endsWith(".m4a") ? "audio/mp4" : "audio/wav";
                const formData = new FormData();
                formData.append("file", new Blob([audioBytes], { type: mimeType }), path.basename(audioPath));
                formData.append("model", "whisper-1");
                formData.append("response_format", "verbose_json");
                formData.append("timestamp_granularities[]", "word");
                formData.append("timestamp_granularities[]", "segment");

                const hinglishPrompt = "Transcribe in Hinglish (Hindi written using English/Latin alphabet, e.g. 'haan bhai kya haal hai, aaj hum baat karenge, yeh bahut accha hai'). Do NOT translate into English, keep exact spoken words in Latin script.";
                if (language === "hinglish") {
                    formData.append("prompt", hinglishPrompt);
                } else if (language === "hi") {
                    formData.append("language", "hi");
                } else if (language === "en") {
                    formData.append("language", "en");
                }

                logger.info(`Transcribing audio via OpenAI Whisper API (size: ${(audioBytes.length / (1024 * 1024)).toFixed(2)} MB, lang: ${language}, attempt ${attempt}/${retries})...`);

                const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    timeout: 120000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                return this.normalizeWhisperJson(response.data);
            } catch (err: any) {
                const status = err.response?.status;
                const errorMsg = err.response?.data?.error?.message || err.message;
                logger.warn(`OpenAI Whisper attempt ${attempt}/${retries} failed (${status || errorMsg}).`);
                
                if (attempt < retries) {
                    const delayMs = attempt * 2500;
                    logger.info(`Retrying OpenAI chunk in ${delayMs / 1000}s...`);
                    await new Promise((r) => setTimeout(r, delayMs));
                } else {
                    throw err;
                }
            }
        }
    }

    // function to transcribe large audio files by splitting into 10-minute segments and concatenating results
    async transcribeInChunks(
        audioPath: string,
        apiKey: string,
        provider: "groq" | "openai",
        onProgress?: (msg: string, percent: number) => Promise<void> | void,
        language = "hinglish"
    ): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
            
            exec(probeCmd, async (err, stdout) => {
                let duration = parseFloat(stdout?.trim() || "0");
                if (isNaN(duration) || duration <= 0) {
                    duration = 3600; // fallback default 1 hour
                }

                const CHUNK_DURATION = 600; // 10 minutes per chunk (well under 5MB each at 48kbps MP3)
                const numChunks = Math.ceil(duration / CHUNK_DURATION);
                const chunkDir = path.join(path.dirname(audioPath), "audio_chunks");
                fs.mkdirSync(chunkDir, { recursive: true });

                const allWords: any[] = [];
                const allSegments: any[] = [];
                let detectedLanguage = "en";

                const initMsg = `Audio Chunking: Splitting ${(duration / 60).toFixed(1)} min audio into ${numChunks} chunks...`;
                logger.info(initMsg);
                if (onProgress) await onProgress(initMsg, 8);

                try {
                    for (let i = 0; i < numChunks; i++) {
                        const offset = i * CHUNK_DURATION;
                        const chunkPath = path.join(chunkDir, `chunk_${i}.mp3`);
                        const chunkPercent = Math.round(10 + ((i / numChunks) * 55)); // 10% to 65% during transcription
                        const progressMsg = `Transcribing chunk ${i + 1}/${numChunks} (${(offset / 60).toFixed(0)} - ${((offset + CHUNK_DURATION) / 60).toFixed(0)} min)...`;

                        logger.info(progressMsg);
                        if (onProgress) await onProgress(progressMsg, chunkPercent);

                        await new Promise<void>((resChunk, rejChunk) => {
                            const splitCmd = `ffmpeg -y -ss ${offset} -t ${CHUNK_DURATION} -i "${audioPath}" -c:a copy "${chunkPath}"`;
                            exec(splitCmd, (splitErr) => {
                                if (splitErr) return rejChunk(splitErr);
                                resChunk();
                            });
                        });

                        try {
                            const chunkResult = provider === "groq"
                                ? await this.transcribeGroqSingle(chunkPath, apiKey, 3, language)
                                : await this.transcribeOpenAISingle(chunkPath, apiKey, 3, language);

                            if (chunkResult?.language) detectedLanguage = chunkResult.language;

                            if (chunkResult?.words) {
                                for (const w of chunkResult.words) {
                                    allWords.push({
                                        ...w,
                                        start: +(Number(w.start || 0) + offset).toFixed(3),
                                        end: +(Number(w.end || 0) + offset).toFixed(3)
                                    });
                                }
                            }

                            if (chunkResult?.segments) {
                                for (const s of chunkResult.segments) {
                                    allSegments.push({
                                        ...s,
                                        start: +(Number(s.start || 0) + offset).toFixed(3),
                                        end: +(Number(s.end || 0) + offset).toFixed(3)
                                    });
                                }
                            }
                        } catch (chunkErr: any) {
                            logger.warn(`Chunk ${i + 1}/${numChunks} failed after retries (${chunkErr.message}). Continuing with remaining chunks.`);
                            if (onProgress) await onProgress(`Chunk ${i + 1}/${numChunks} skipped (minor gap). Continuing...`, chunkPercent);
                        }

                        try { fs.unlinkSync(chunkPath); } catch {}
                    }

                    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}

                    if (onProgress) await onProgress(`Transcription complete! Found ${allWords.length} words.`, 70);

                    resolve({
                        language: detectedLanguage,
                        duration,
                        words: allWords,
                        segments: allSegments.length > 0 ? allSegments : this.buildSegments(allWords)
                    });
                } catch (chunkErr: any) {
                    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
                    reject(chunkErr);
                }
            });
        });
    }

    // function to check if whisper cli is installed on host/container
    async isWhisperCliAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            exec("whisper --help", (error) => {
                resolve(!error);
            });
        });
    }

    // function to transcribe audio with automatic smart provider resolution
    async transcribeAuto(
        audioPath: string,
        keys: { groq?: string; openai?: string; deepgram?: string },
        projectDir?: string
    ) {
        const groqKey = keys.groq || process.env.GROQ_API_KEY;
        const openaiKey = keys.openai || process.env.OPENAI_API_KEY;
        const deepgramKey = keys.deepgram || process.env.DEEPGRAM_API_KEY;

        // 1. Prefer Groq Whisper (ultra fast, high quality whisper-large-v3)
        if (groqKey) {
            try {
                logger.info("Using Groq Whisper API for transcription...");
                return await this.transcribeGroq(audioPath, groqKey);
            } catch (err: any) {
                logger.warn(`Groq transcription failed (${err.message}). Trying next available provider...`);
            }
        }

        // 2. OpenAI Whisper API
        if (openaiKey) {
            try {
                logger.info("Using OpenAI Whisper API for transcription...");
                return await this.transcribeOpenAI(audioPath, openaiKey);
            } catch (err: any) {
                logger.warn(`OpenAI transcription failed (${err.message}). Trying next available provider...`);
            }
        }

        // 3. Deepgram API
        if (deepgramKey) {
            try {
                logger.info("Using Deepgram API for transcription...");
                return await this.transcribeDeepgram(audioPath, deepgramKey);
            } catch (err: any) {
                logger.warn(`Deepgram transcription failed (${err.message}). Trying local whisper...`);
            }
        }

        // 4. Try local CLI if available
        const hasLocalCli = await this.isWhisperCliAvailable();
        if (hasLocalCli) {
            logger.info("Using local Whisper CLI for transcription...");
            return await this.transcribeLocal(audioPath, projectDir);
        }

        // 5. If no provider worked
        throw new Error(
            "Transcription could not start: Local Whisper CLI is not installed in the server environment, and no API Key (Groq, OpenAI, or Deepgram) was found. Please add a Groq, OpenAI, or Deepgram API Key in Settings."
        );
    }

    // function to transcribe audio using local whisper CLI
    async transcribeLocal(audioPath: string, outputDir?: string) {

        return new Promise((resolve, reject) => {

            const audioPathBuf = path.resolve(audioPath);
            const audioDir = outputDir || path.dirname(audioPathBuf);
            const audioStem = path.basename(audioPathBuf, path.extname(audioPathBuf));

            const outputJsonPath = path.join(audioDir, `${audioStem}.json`);

            // constructing the whisper CLI command
            const cmd = `whisper "${audioPathBuf}" --model base --output_format json --output_dir "${audioDir}" --word_timestamps True`;

            logger.info(`running local whisper command: ${cmd}`);

            // executing the command
            exec(cmd, (error, stdout, stderr) => {

                if (error) {

                    logger.error(`local whisper CLI execution failed: ${stderr || error.message}`);
                    return reject(new Error(`local whisper CLI failed: ${stderr || error.message}`));

                }

                try {

                    // reading the output JSON file
                    if (!fs.existsSync(outputJsonPath)) {

                        return reject(new Error(`whisper did not generate expected json output at ${outputJsonPath}`));

                    }

                    const jsonBytes = fs.readFileSync(outputJsonPath, "utf-8");
                    const rawJson = JSON.parse(jsonBytes);

                    // cleaning up files generated by whisper
                    try {

                        fs.unlinkSync(outputJsonPath);

                        const extraExtensions = [".txt", ".srt", ".vtt", ".tsv"];

                        for (const ext of extraExtensions) {

                            const extraFile = path.join(audioDir, `${audioStem}${ext}`);

                            if (fs.existsSync(extraFile)) {

                                fs.unlinkSync(extraFile);

                            }

                        }

                    }
                    catch (cleanupErr: any) {

                        logger.warn(`whisper file cleanup warning: ${cleanupErr.message}`);

                    }

                    // normalizing whisper JSON format
                    const normalized = this.normalizeWhisperJson(rawJson);
                    resolve(normalized);

                }
                catch (parseErr: any) {

                    reject(new Error(`failed to parse local whisper json output: ${parseErr.message}`));

                }

            });

        });

    }

    // function to normalize Whisper JSON format
    normalizeWhisperJson(raw: any) {

        const language = raw.language || "en";
        const segmentsArr = raw.segments || [];

        const duration = raw.duration || (segmentsArr.length > 0 ? segmentsArr[segmentsArr.length - 1].end : 0.0);

        const segments: any[] = [];
        const words: any[] = [];

        for (const seg of segmentsArr) {

            const start = seg.start || 0.0;
            const end = seg.end || 0.0;
            const text = (seg.text || "").trim();

            segments.push({
                start,
                end,
                speaker: "S1",
                text
            });

            const rawWords = seg.words || [];

            for (const w of rawWords) {

                const wordText = (w.word || "").trim();
                const wordStart = w.start || 0.0;
                const wordEnd = w.end || 0.0;

                words.push({
                    text: wordText,
                    start: wordStart,
                    end: wordEnd,
                    speaker: "S1"
                });

            }

        }

        return {
            language,
            duration,
            speakers: ["S1"],
            words,
            segments
        };

    }

}

export default TranscriptionService;
