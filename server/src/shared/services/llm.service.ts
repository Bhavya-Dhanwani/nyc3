// Importing modules
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

// defining the zod validation schemas for structured output parsing
export const candidateSchema = z.object({
    title: z.string().optional().describe("A catchy descriptive title for this clip (max 8 words)"),
    start: z.number().describe("The start timestamp in seconds from the transcript"),
    end: z.number().describe("The end timestamp in seconds from the transcript"),
    hook: z.string().describe("The engaging hook sentence/phrase within the first 3-5 seconds"),
    rationale: z.string().describe("Explanation of why this clip makes a high-impact standalone short"),
    hookScore: z.number().min(0).max(100).optional().describe("Hook strength score from 0 to 100"),
    standaloneScore: z.number().min(0).max(100).optional().describe("Standalone context clarity score from 0 to 100"),
    emotionScore: z.number().min(0).max(100).optional().describe("Emotional energy / engagement score from 0 to 100"),
    curiosityScore: z.number().min(0).max(100).optional().describe("Curiosity / intrigue score from 0 to 100"),
    payoffScore: z.number().min(0).max(100).optional().describe("Clear conclusion / payoff score from 0 to 100"),
    formatFitScore: z.number().min(0).max(100).optional().describe("Suitability for 9:16 Shorts/Reels/TikTok score from 0 to 100"),
    score: z.number().min(0).max(100).optional().describe("Overall virality score from 0 to 100")
});

export const outputSchema = z.object({
    candidates: z.array(candidateSchema).describe("List of identified high-impact clip candidates")
});

export interface ScoreBreakdown {
    hook: number;
    standalone: number;
    emotion: number;
    curiosity: number;
    payoff: number;
    formatFit: number;
}

export interface CandidateResult {
    title: string;
    start: number;
    end: number;
    duration: number;
    score: number;
    hook: string;
    rationale: string;
    scoreBreakdown: ScoreBreakdown;
}

// class to handle LLM operations via LangChain
class LlmService {

    // function to compact transcript segments for LLM prompt
    compactSegments(segments: any[]): string {
        if (!segments || segments.length === 0) return "";
        return segments
            .map(seg => {
                const speaker = seg.speaker || "Speaker";
                const start = Number(seg.start || 0).toFixed(2);
                const end = Number(seg.end || 0).toFixed(2);
                return `[${start}-${end}] ${speaker}: ${seg.text}`;
            })
            .join("\n");
    }

    // function to construct LLM prompt
    buildPrompt(compactedTranscript: string, durationStyle = "mixed", targetCount = 6): string {
        let lengthInstruction = "exactly 60 seconds long";

        if (durationStyle === "one-minute") {
            lengthInstruction = "exactly 60 seconds long (never shorter and never looped)";
        } else if (durationStyle === "short") {
            lengthInstruction = "15-30 seconds long";
        } else if (durationStyle === "medium") {
            lengthInstruction = "30-60 seconds long";
        } else if (durationStyle === "long") {
            lengthInstruction = "60-90 seconds long";
        } else if (durationStyle === "mixed") {
            lengthInstruction = "20-75 seconds long";
        }

        return `You are an elite short-form video editor and content strategist specializing in YouTube Shorts, Instagram Reels, and TikTok virality.
Analyze the following timestamped transcript and identify the top ${targetCount} most engaging, high-retention moments that can stand completely on their own as independent short-form clips.

EVALUATION CRITERIA:
1. Strong Opening Hook (25%): The clip MUST start with a compelling question, surprising claim, pattern interrupt, or high curiosity within the first 3 seconds.
2. Standalone Value (20%): The clip must make complete sense to a viewer who hasn't seen the rest of the video. Avoid references to unintroduced topics.
3. Emotion / Energy (15%): High conversational energy, enthusiasm, debate, passion, or humor.
4. Curiosity / Intrigue (15%): Creates an itch that keeps the viewer watching.
5. Strong Payoff (15%): Delivers on the premise/hook with a concrete takeaway, insight, punchline, or conclusion.
6. Short-Form Fit (10%): Concise, punchy pacing suited for 9:16 vertical video.

CRITICAL TIMING RULES:
- Each candidate clip duration (end - start) MUST strictly be ${lengthInstruction}.
- Start and end timestamps MUST match the bracketed timestamps in the transcript.
- Cut cleanly at natural sentence/thought boundaries.

Transcript:
${compactedTranscript}`;
    }

    // splits long transcripts into overlapping sliding windows for large video handling
    createTranscriptWindows(segments: any[], windowDurationSec = 240, overlapSec = 45): { segments: any[]; startTime: number; endTime: number }[] {
        if (!segments || segments.length === 0) return [];

        const totalDuration = segments[segments.length - 1]?.end || 0;
        if (totalDuration <= windowDurationSec + 30) {
            return [{ segments, startTime: 0, endTime: totalDuration }];
        }

        const windows: { segments: any[]; startTime: number; endTime: number }[] = [];
        let windowStart = 0;
        const step = windowDurationSec - overlapSec;

        while (windowStart < totalDuration) {
            const windowEnd = windowStart + windowDurationSec;
            const windowSegments = segments.filter(s => s.end >= windowStart && s.start <= windowEnd);

            if (windowSegments.length > 0) {
                windows.push({
                    segments: windowSegments,
                    startTime: windowStart,
                    endTime: windowEnd
                });
            }

            windowStart += step;
            if (windowStart + 30 >= totalDuration) break;
        }

        return windows;
    }

    // calculates multi-factor score breakdown
    calculateCandidateScore(item: any): { score: number; breakdown: ScoreBreakdown } {
        const hook = clampScore(item.hookScore ?? (item.score ? item.score * 100 : 85));
        const standalone = clampScore(item.standaloneScore ?? 80);
        const emotion = clampScore(item.emotionScore ?? 75);
        const curiosity = clampScore(item.curiosityScore ?? 80);
        const payoff = clampScore(item.payoffScore ?? 85);
        const formatFit = clampScore(item.formatFitScore ?? 85);

        // Weighted virality formula: Hook 25%, Standalone 20%, Emotion 15%, Curiosity 15%, Payoff 15%, FormatFit 10%
        const weightedScore = Math.round(
            hook * 0.25 +
            standalone * 0.20 +
            emotion * 0.15 +
            curiosity * 0.15 +
            payoff * 0.15 +
            formatFit * 0.10
        );

        return {
            score: weightedScore,
            breakdown: {
                hook,
                standalone,
                emotion,
                curiosity,
                payoff,
                formatFit
            }
        };
    }

    // deduplicates overlapping candidates and keeps the strongest variation
    deduplicateCandidates(candidates: CandidateResult[], maxOverlapRatio = 0.35): CandidateResult[] {
        if (!candidates || candidates.length <= 1) return candidates;

        // Sort descending by score
        const sorted = [...candidates].sort((a, b) => b.score - a.score);
        const selected: CandidateResult[] = [];

        for (const candidate of sorted) {
            let isDuplicate = false;

            for (const existing of selected) {
                const overlapStart = Math.max(candidate.start, existing.start);
                const overlapEnd = Math.min(candidate.end, existing.end);
                const overlapDuration = Math.max(0, overlapEnd - overlapStart);

                const minDuration = Math.min(candidate.duration, existing.duration);
                const overlapRatio = minDuration > 0 ? overlapDuration / minDuration : 0;

                if (overlapRatio > maxOverlapRatio) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                selected.push(candidate);
            }
        }

        return selected.sort((a, b) => b.score - a.score);
    }

    // processes raw LLM candidate items into validated and scored records
    normalizeCandidates(drafts: any[], transcriptDuration: number, durationStyle = "mixed"): CandidateResult[] {
        let minDuration = 10.0;
        let maxDuration = 90.0;
        const forceOneMinute = durationStyle === "one-minute";

        if (durationStyle === "one-minute") {
            minDuration = 60.0;
            maxDuration = 60.0;
        } else if (durationStyle === "short") {
            minDuration = 10.0;
            maxDuration = 30.0;
        } else if (durationStyle === "medium") {
            minDuration = 25.0;
            maxDuration = 60.0;
        } else if (durationStyle === "long") {
            minDuration = 45.0;
            maxDuration = 120.0;
        } else {
            minDuration = transcriptDuration < 60.0 ? Math.max(transcriptDuration * 0.3, 5.0) : 15.0;
            maxDuration = 90.0;
        }

        const processed: CandidateResult[] = [];

        for (const item of drafts) {
            let start = parseFloat(item.start) || 0.0;
            let end = parseFloat(item.end) || 0.0;

            if (start < 0) start = 0;
            if (forceOneMinute && transcriptDuration >= 60) {
                start = Math.min(start, transcriptDuration - 60);
                end = start + 60;
            }
            if (end > transcriptDuration && transcriptDuration > 0) end = transcriptDuration;
            if (end <= start) continue;

            const duration = Number((end - start).toFixed(2));
            const { score, breakdown } = this.calculateCandidateScore(item);

            const title = item.title?.trim() || `Viral Moment (${Math.round(start)}s - ${Math.round(end)}s)`;
            const hook = item.hook?.trim() || title;
            const rationale = item.rationale?.trim() || "High conversational engagement moment";

            processed.push({
                title,
                start: Number(start.toFixed(2)),
                end: Number(end.toFixed(2)),
                duration,
                score,
                hook,
                rationale,
                scoreBreakdown: breakdown
            });
        }

        // Filter by duration and hook presence
        let filtered = processed.filter(c => forceOneMinute ? Math.abs(c.duration - 60) <= 0.01 : c.duration >= minDuration && c.duration <= maxDuration && c.hook.length > 0);

        if (filtered.length === 0 && !forceOneMinute) {
            filtered = processed.filter(c => c.duration >= 5.0 && c.hook.length > 0);
        }

        return filtered;
    }

    // executes LangChain structured model query
    async runLangchainModel(model: any, transcript: any, durationStyle = "mixed", targetCount = 6): Promise<CandidateResult[]> {
        const segments = transcript.segments || [];
        const windows = this.createTranscriptWindows(segments, 240, 45);

        const allCandidates: CandidateResult[] = [];

        for (const window of windows) {
            const compacted = this.compactSegments(window.segments);
            if (!compacted.trim()) continue;

            const prompt = this.buildPrompt(compacted, durationStyle, Math.max(3, Math.min(targetCount, 8)));
            const structuredModel = model.withStructuredOutput(outputSchema);

            try {
                const result = await structuredModel.invoke([
                    {
                        role: "system",
                        content: "You are a professional social media video editor specializing in viral moment detection."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]);

                const drafts = result?.candidates || [];
                const normalized = this.normalizeCandidates(drafts, transcript.duration || 999999, durationStyle);
                allCandidates.push(...normalized);
            } catch (err: any) {
                logger.warn(`Window analysis sub-call failed: ${err.message}`);
            }
        }

        // Deduplicate overlapping moments across windows
        const deduplicated = this.deduplicateCandidates(allCandidates, 0.35);
        return deduplicated.slice(0, targetCount);
    }

    // instantiate model dynamically based on provider
    createModelInstance(provider: string, apiKey?: string, modelName?: string) {
        const norm = (provider || "mistral").toLowerCase().trim();

        if (norm === "mistral" || norm === "mixtral") {
            const key = apiKey || process.env.MISTRAL_API_KEY || env.MISTRAL_API_KEY;
            return new ChatOpenAI({
                modelName: modelName || process.env.MISTRAL_MODEL || "mistral-large-latest",
                apiKey: key || "mistral-key",
                configuration: {
                    baseURL: "https://api.mistral.ai/v1"
                },
                temperature: 0.2
            });
        }

        if (norm === "groq") {
            const key = apiKey || process.env.GROQ_API_KEY || env.GROQ_API_KEY;
            return new ChatGroq({
                model: modelName || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                apiKey: key || "groq-key",
                temperature: 0.2
            });
        }

        if (norm === "openrouter") {
            const key = apiKey || process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
            return new ChatOpenAI({
                modelName: modelName || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
                apiKey: key || "openrouter-key",
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1"
                },
                temperature: 0.2
            });
        }

        if (norm === "ollama" || norm === "local") {
            return new ChatOpenAI({
                modelName: modelName || process.env.OLLAMA_MODEL || "llama3.2",
                apiKey: "ollama",
                configuration: {
                    baseURL: `${env.OLLAMA_HOST}/v1`
                },
                temperature: 0.2
            });
        }

        if (norm === "openai") {
            const key = apiKey || process.env.OPENAI_API_KEY;
            return new ChatOpenAI({
                modelName: modelName || process.env.OPENAI_MODEL || "gpt-4o-mini",
                apiKey: key || "openai-key",
                temperature: 0.2
            });
        }

        if (norm === "claude" || norm === "anthropic") {
            const key = apiKey || process.env.ANTHROPIC_API_KEY;
            return new ChatAnthropic({
                modelName: modelName || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
                apiKey: key || "anthropic-key",
                temperature: 0.2
            });
        }

        if (norm === "gemini") {
            const key = apiKey || process.env.GEMINI_API_KEY;
            return new ChatOpenAI({
                modelName: modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash",
                apiKey: key || "gemini-key",
                configuration: {
                    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai"
                },
                temperature: 0.2
            });
        }

        if (norm === "deepseek") {
            const key = apiKey || process.env.DEEPSEEK_API_KEY;
            return new ChatOpenAI({
                modelName: modelName || process.env.DEEPSEEK_MODEL || "deepseek-chat",
                apiKey: key || "deepseek-key",
                configuration: {
                    baseURL: "https://api.deepseek.com/v1"
                },
                temperature: 0.2
            });
        }

        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // detects moments with automatic fallback chain across configured providers
    async detectMomentsWithFallbackChain(
        transcript: any,
        primaryProvider: string,
        primaryKey?: string | string[],
        modelName?: string,
        durationStyle = "mixed",
        targetCount = 6,
        userKeys: Record<string, string[]> = {}
    ): Promise<CandidateResult[]> {
        const fallbackList = (env.LLM_FALLBACK_PROVIDERS || "groq,openrouter,ollama,deepseek,openai,gemini,claude")
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        const providersToTry = [primaryProvider.toLowerCase(), ...fallbackList.filter(p => p !== primaryProvider.toLowerCase())];
        let lastError: Error | null = null;

        for (const provider of providersToTry) {
            const keysForProvider = provider === primaryProvider.toLowerCase() 
                ? (Array.isArray(primaryKey) ? primaryKey : primaryKey ? [primaryKey] : [])
                : (userKeys[provider] || []);
            
            // Ensure we have at least one attempt even without keys (for ollama etc.)
            const keysToTry = keysForProvider.length > 0 ? keysForProvider : [undefined];
            
            for (let ki = 0; ki < keysToTry.length; ki++) {
                try {
                    const key = keysToTry[ki];
                    logger.info(`Attempting moment detection with provider "${provider}" (key ${ki + 1}/${keysToTry.length})...`);
                    const model = this.createModelInstance(provider, key, modelName);
                    const candidates = await this.runLangchainModel(model, transcript, durationStyle, targetCount);
                    if (candidates && candidates.length > 0) {
                        logger.info(`Successfully generated ${candidates.length} candidates using provider "${provider}" (key ${ki + 1})`);
                        return candidates;
                    }
                } catch (err: any) {
                    lastError = err;
                    const is429 = err.status === 429 || err.response?.status === 429 || 
                                  err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
                    if (is429 && ki < keysToTry.length - 1) {
                        logger.warn(`Provider "${provider}" key ${ki + 1} rate-limited (429). Trying next key...`);
                        continue;
                    }
                    logger.warn(`Provider "${provider}" failed: ${err.message}. Trying next fallback...`);
                    break;
                }
            }
        }

        throw new Error(`All LLM providers in fallback chain failed. Last error: ${lastError?.message || "Unknown error"}`);
    }

    // Direct provider helper methods
    async detectWithMistral(transcript: any, apiKey?: string, modelName?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("mistral", apiKey, modelName);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithGroq(transcript: any, apiKey?: string, modelName?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("groq", apiKey, modelName);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithOpenrouter(transcript: any, apiKey?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("openrouter", apiKey);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithOllama(transcript: any, modelName?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("ollama", undefined, modelName);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithOpenai(transcript: any, apiKey?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("openai", apiKey);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithClaude(transcript: any, apiKey?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("claude", apiKey);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithGemini(transcript: any, apiKey?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("gemini", apiKey);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

    async detectWithDeepseek(transcript: any, apiKey?: string, durationStyle = "mixed", targetCount = 6) {
        const model = this.createModelInstance("deepseek", apiKey);
        return this.runLangchainModel(model, transcript, durationStyle, targetCount);
    }

}

function clampScore(val: any): number {
    const num = Number(val);
    if (!Number.isFinite(num)) return 80;
    if (num <= 1.0 && num > 0) return Math.round(num * 100);
    return Math.max(0, Math.min(100, Math.round(num)));
}

export default LlmService;









