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
    contentType: z.string().optional().describe("Primary content type: Viral, Educational, Funny, Emotional, Story, Opinion, Tutorial, Business, Inspirational, Controversial, How-To, News"),
    secondaryTypes: z.array(z.string()).optional().describe("Secondary content types"),
    topic: z.string().optional().describe("Main theme or topic"),
    subtopic: z.string().optional().describe("Specific subtopic"),
    summary: z.string().optional().describe("1-2 sentence summary"),
    emotion: z.string().optional().describe("Primary emotion invoked, e.g. Shock, Curiosity, Amusement, Inspiration"),
    audience: z.string().optional().describe("Target audience segment"),
    hookType: z.string().optional().describe("Hook style: Curiosity, Question, Contrarian, Shock, Result, Story, Confession, Tutorial, Statement"),
    recommendedPlatforms: z.array(z.string()).optional().describe("Best platforms e.g. TikTok, Instagram Reels, YouTube Shorts, LinkedIn, X"),
    suggestedTitles: z.array(z.object({
        title: z.string(),
        style: z.string().describe("Style: Curiosity, Direct, SEO, Contrarian, Educational, Story, Short")
    })).optional(),
    suggestedHooks: z.array(z.object({
        hook: z.string(),
        hookType: z.string().describe("Hook type"),
        reason: z.string().describe("Why this hook works")
    })).optional(),
    suggestedCaptions: z.object({
        instagram: z.object({ caption: z.string(), cta: z.string(), hashtags: z.string() }).optional(),
        tiktok: z.object({ caption: z.string(), cta: z.string(), hashtags: z.string() }).optional(),
        youtube: z.object({ title: z.string(), description: z.string(), tags: z.string() }).optional(),
        linkedin: z.object({ post: z.string(), takeaway: z.string(), question: z.string() }).optional(),
        twitter: z.object({ post: z.string() }).optional()
    }).optional(),
    hookScore: z.number().min(0).max(100).optional().describe("Hook strength score from 0 to 100"),
    standaloneScore: z.number().min(0).max(100).optional().describe("Standalone context clarity score from 0 to 100"),
    emotionScore: z.number().min(0).max(100).optional().describe("Emotional energy / engagement score from 0 to 100"),
    curiosityScore: z.number().min(0).max(100).optional().describe("Curiosity / intrigue score from 0 to 100"),
    payoffScore: z.number().min(0).max(100).optional().describe("Clear conclusion / payoff score from 0 to 100"),
    formatFitScore: z.number().min(0).max(100).optional().describe("Suitability for 9:16 Shorts/Reels/TikTok score from 0 to 100"),
    visualInterestScore: z.number().min(0).max(100).optional().describe("Visual dynamism/interest score from 0 to 100"),
    contextScore: z.number().min(0).max(100).optional().describe("Context completeness score from 0 to 100"),
    shareabilityScore: z.number().min(0).max(100).optional().describe("Viral shareability score from 0 to 100"),
    score: z.number().min(0).max(100).optional().describe("Overall virality score from 0 to 100")
});

export const outputSchema = z.object({
    candidates: z.array(candidateSchema).describe("List of identified high-impact clip candidates with full content intelligence")
});

export interface ScoreBreakdown {
    hook: number;
    standalone: number;
    emotion: number;
    curiosity: number;
    payoff: number;
    formatFit: number;
    visualInterest: number;
    context: number;
    shareability: number;
}

export interface CandidateResult {
    title: string;
    start: number;
    end: number;
    duration: number;
    score: number;
    hook: string;
    rationale: string;
    contentType?: string;
    secondaryTypes?: string[];
    topic?: string;
    subtopic?: string;
    summary?: string;
    emotion?: string;
    audience?: string;
    hookType?: string;
    recommendedPlatforms?: string[];
    suggestedTitles?: Array<{ title: string; style: string; score?: number }>;
    suggestedHooks?: Array<{ hook: string; hookType: string; score?: number; reason?: string }>;
    suggestedCaptions?: any;
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

    // function to construct LLM prompt for deep Content Intelligence
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

        return `You are Katetor, an elite AI short-form video director, content strategist, and virality expert specializing in YouTube Shorts, Instagram Reels, and TikTok.
Analyze the following timestamped transcript of a video. Perform full content intelligence: identify topics, subtopics, stories, opinions, humor, lessons, emotional peaks, and extract the top ${targetCount} highest-impact, standalone viral clips.

FOR EACH CLIP GENERATE:
1. Title: Catchy, punchy title (max 8 words).
2. Content Type: Primary type chosen from [Viral, Educational, Funny, Emotional, Story, Opinion, Tutorial, Business, Inspirational, Controversial, How-To, News].
3. Secondary Types: Optional 1-2 secondary tags from the above list.
4. Topic & Subtopic: Core subject of the moment.
5. Summary: 1-2 sentence description of what happens.
6. Opening Hook: Exact strong phrase from the first 3 seconds.
7. Hook Type: Chosen from [Curiosity, Question, Contrarian, Shock, Result, Story, Confession, Tutorial, Statement].
8. Target Audience & Emotion: Who should watch this, and what they feel.
9. Rationale: Concrete explanation of why this moment will succeed standalone.
10. Multi-Factor Scores (0-100): Hook (20%), Standalone (15%), Emotion (15%), Curiosity (15%), Payoff (15%), FormatFit (10%), VisualInterest (10%), Context (10%), Shareability (10%).
11. Recommended Platforms: Array containing suitable platforms from ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X"].
12. 5 Alternative Hook Variations: Distinct rewritten opening hooks (Curiosity, Contrarian, Question, Result, Shock).
13. 5 Alternative Titles: Style-specific titles (Curiosity, Direct, SEO, Contrarian, Story).
14. Ready-to-use Platform Captions: Tailored social media copy for Instagram (caption, CTA, hashtags), TikTok (punchy caption, hashtags), YouTube (title, description, tags), LinkedIn (professional post, takeaway, question), X (concise tweet/thread).

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
        const visualInterest = clampScore(item.visualInterestScore ?? 80);
        const context = clampScore(item.contextScore ?? 85);
        const shareability = clampScore(item.shareabilityScore ?? 88);

        // Weighted virality formula: Hook 20%, Standalone 15%, Emotion 15%, Curiosity 15%, Payoff 15%, FormatFit 5%, VisualInterest 5%, Context 5%, Shareability 5%
        const weightedScore = Math.round(
            hook * 0.20 +
            standalone * 0.15 +
            emotion * 0.15 +
            curiosity * 0.15 +
            payoff * 0.15 +
            formatFit * 0.05 +
            visualInterest * 0.05 +
            context * 0.05 +
            shareability * 0.05
        );

        return {
            score: Math.max(50, Math.min(99, weightedScore)),
            breakdown: {
                hook,
                standalone,
                emotion,
                curiosity,
                payoff,
                formatFit,
                visualInterest,
                context,
                shareability
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
            const rationale = item.rationale?.trim() || "High conversational engagement moment with strong narrative tension.";
            const contentType = item.contentType?.trim() || "Viral";
            const secondaryTypes = Array.isArray(item.secondaryTypes) ? item.secondaryTypes : [];
            const topic = item.topic?.trim() || "Key Takeaway";
            const subtopic = item.subtopic?.trim() || "";
            const summary = item.summary?.trim() || rationale;
            const emotion = item.emotion?.trim() || "Curiosity";
            const audience = item.audience?.trim() || "General Audience";
            const hookType = item.hookType?.trim() || "Curiosity";
            const recommendedPlatforms = Array.isArray(item.recommendedPlatforms) && item.recommendedPlatforms.length > 0
                ? item.recommendedPlatforms
                : ["TikTok", "Instagram Reels", "YouTube Shorts"];

            // Format suggested titles with fallbacks
            const suggestedTitles = Array.isArray(item.suggestedTitles) && item.suggestedTitles.length > 0
                ? item.suggestedTitles.map((t: any) => ({
                    title: String(t.title || t),
                    style: String(t.style || "Direct"),
                    score: Math.min(99, Math.max(70, Math.round(score - Math.random() * 8)))
                }))
                : [
                    { title: title, style: "Direct", score: score },
                    { title: `Why You Need To Know This About ${topic}`, style: "Curiosity", score: score - 2 },
                    { title: `The Truth About ${topic}`, style: "Contrarian", score: score - 4 }
                ];

            // Format suggested hooks with fallbacks
            const suggestedHooks = Array.isArray(item.suggestedHooks) && item.suggestedHooks.length > 0
                ? item.suggestedHooks.map((h: any) => ({
                    hook: String(h.hook || h),
                    hookType: String(h.hookType || "Curiosity"),
                    score: Math.min(99, Math.max(75, Math.round(score - Math.random() * 6))),
                    reason: String(h.reason || "Creates instant curiosity gap")
                }))
                : [
                    { hook: `"${hook}"`, hookType: "Curiosity", score: score, reason: "Original powerful speaker statement" },
                    { hook: `You've probably been thinking about ${topic} completely wrong...`, hookType: "Contrarian", score: score - 2, reason: "Pattern interrupt challenge" },
                    { hook: `What if everything you knew about this changed today?`, hookType: "Question", score: score - 4, reason: "Immediate question curiosity" }
                ];

            // Format platform captions with fallbacks
            const suggestedCaptions = item.suggestedCaptions || {
                instagram: {
                    caption: `${title}\n\n${summary}\n\nSave this for later! 📌`,
                    cta: "Drop a comment below with your thoughts 👇",
                    hashtags: "#viral #trending #reels #shorts #contentcreator"
                },
                tiktok: {
                    caption: `Wait until the end... 🤯 ${summary}`,
                    cta: "Follow for daily insights 🔥",
                    hashtags: "#fyp #viral #learnontiktok"
                },
                youtube: {
                    title: title,
                    description: `${summary}\n\nSubscribe for more short-form highlights!`,
                    tags: "shorts, youtube shorts, podcast clip, viral video"
                },
                linkedin: {
                    post: `Key takeaway on ${topic}:\n\n${summary}\n\nWhat are your thoughts on this approach?`,
                    takeaway: `Mastering ${topic} requires focusing on clarity and rapid iteration.`,
                    question: "How do you handle this in your daily workflow?"
                },
                twitter: {
                    post: `1/3 Here's a powerful lesson on ${topic}: "${hook}" 👇`
                }
            };

            processed.push({
                title,
                start: Number(start.toFixed(2)),
                end: Number(end.toFixed(2)),
                duration,
                score,
                hook,
                rationale,
                contentType,
                secondaryTypes,
                topic,
                subtopic,
                summary,
                emotion,
                audience,
                hookType,
                recommendedPlatforms,
                suggestedTitles,
                suggestedHooks,
                suggestedCaptions,
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
                        content: "You are Katetor, an elite AI short-form video director and viral content strategist."
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
            throw new Error("Local LLM providers (Ollama) are disabled.");
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
        const fallbackList = (env.LLM_FALLBACK_PROVIDERS || "groq,openrouter,deepseek,openai,gemini,claude")
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

    // Generate tailored hooks on demand for a selected candidate
    async generateHookOptions(clipText: string, topic = "", provider = "mistral", apiKey?: string) {
        const prompt = `You are a viral TikTok/Reels hook specialist.
Given this clip dialogue: "${clipText}"
Topic: ${topic || "General"}

Generate 5 distinct, high-impact hook variations categorized by:
1. Curiosity ("After 6 years of doing X, I realized this...")
2. Contrarian ("Most people do X completely backwards.")
3. Question ("Why are most people still making this huge mistake?")
4. Shock ("I wasted years before learning this simple truth.")
5. Result ("This one subtle tweak 10x'd my output.")

Return JSON format with array of objects: [{ "hook": string, "hookType": string, "score": number, "reason": string }]`;

        try {
            const model = this.createModelInstance(provider, apiKey);
            const schema = z.object({
                hooks: z.array(z.object({
                    hook: z.string(),
                    hookType: z.string(),
                    score: z.number().min(60).max(99),
                    reason: z.string()
                }))
            });
            const structured = model.withStructuredOutput(schema);
            const res = await structured.invoke([{ role: "user", content: prompt }]);
            return res.hooks;
        } catch (e: any) {
            logger.warn(`On-demand hook generation failed: ${e.message}`);
            return [
                { hook: `"${clipText.slice(0, 80)}..."`, hookType: "Original", score: 92, reason: "Original speaker opening" },
                { hook: `Most people get this completely wrong...`, hookType: "Contrarian", score: 94, reason: "Pattern interrupt" },
                { hook: `This one insight completely changed how I look at this:`, hookType: "Curiosity", score: 91, reason: "Information gap" },
                { hook: `Why does nobody talk about this?`, hookType: "Question", score: 89, reason: "Direct curiosity trigger" },
                { hook: `I wish I knew this years ago:`, hookType: "Shock", score: 95, reason: "High FOMO" }
            ];
        }
    }

    // Generate AI titles on demand
    async generateTitleOptions(clipText: string, topic = "", provider = "mistral", apiKey?: string) {
        const prompt = `Generate 6 high-CTR titles in distinct styles (Curiosity, Direct, SEO, Contrarian, Story, Short) for a vertical short with dialogue: "${clipText}". Topic: "${topic}".`;
        try {
            const model = this.createModelInstance(provider, apiKey);
            const schema = z.object({
                titles: z.array(z.object({
                    title: z.string(),
                    style: z.string(),
                    score: z.number().min(60).max(99)
                }))
            });
            const structured = model.withStructuredOutput(schema);
            const res = await structured.invoke([{ role: "user", content: prompt }]);
            return res.titles;
        } catch (e: any) {
            return [
                { title: `Why Most People Get ${topic || "This"} Wrong`, style: "Contrarian", score: 93 },
                { title: `The Secret To ${topic || "Success"} Nobody Tells You`, style: "Curiosity", score: 91 },
                { title: `How To Master ${topic || "This"} in 60 Seconds`, style: "Educational", score: 89 },
                { title: `I Wish I Knew This Earlier`, style: "Story", score: 94 },
                { title: `${topic || "Key Insight"} Explained`, style: "Direct", score: 86 }
            ];
        }
    }

    // Generate structured AI Edit Plan
    async generateAiEditPlan(transcriptText: string, duration: number, userGoal: string, provider = "mistral", apiKey?: string) {
        const prompt = `You are an AI video editor. A user wants to edit a ${duration.toFixed(1)}s video clip.
Goal: "${userGoal || "Make this more engaging, fast-paced and punchy"}"
Transcript: "${transcriptText}"

Create an actionable, itemized AI EDIT PLAN.
Return JSON with:
- summary: string (Overall direction)
- estimatedSavingsSec: number (e.g. 4.2)
- items: array of { action: "remove_pause" | "punch_in" | "reorder" | "emphasize_caption" | "smart_reframe", description: string, timeRange: string, reason: string }`;

        try {
            const model = this.createModelInstance(provider, apiKey);
            const schema = z.object({
                summary: z.string(),
                estimatedSavingsSec: z.number(),
                items: z.array(z.object({
                    action: z.string(),
                    description: z.string(),
                    timeRange: z.string().optional(),
                    reason: z.string()
                }))
            });
            const structured = model.withStructuredOutput(schema);
            return await structured.invoke([{ role: "user", content: prompt }]);
        } catch (e: any) {
            return {
                summary: `Optimized pacing for high viewer retention: removed dead pauses and added punch-in emphasis.`,
                estimatedSavingsSec: 3.4,
                items: [
                    { action: "remove_pause", description: "Trim opening dead air and trailing breath", timeRange: "00:00 - 00:01.2", reason: "Faster hook entry" },
                    { action: "punch_in", description: "Apply 1.15x punch-in zoom on core thesis sentence", timeRange: "00:14 - 00:22", reason: "Visual emphasis" },
                    { action: "emphasize_caption", description: "Highlight keyword text with pop animation", timeRange: "00:28 - 00:35", reason: "Retention boost" },
                    { action: "smart_reframe", description: "Center speaker facial tracking for vertical 9:16", timeRange: "00:00 - 00:60", reason: "Mobile format fit" }
                ]
            };
        }
    }
}

function clampScore(val: any): number {
    const num = Number(val);
    if (!Number.isFinite(num)) return 80;
    if (num <= 1.0 && num > 0) return Math.round(num * 100);
    return Math.max(0, Math.min(100, Math.round(num)));
}

export default LlmService;
