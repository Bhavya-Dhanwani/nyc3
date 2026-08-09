// Subtitle and caption layout utility adapted from /bin/src/lib/captionLayout.js & autoEdit.js

export interface CaptionWord {
    text: string;
    start: number;
    end: number;
    speaker?: string;
}

export interface CaptionWindow {
    words: CaptionWord[];
    text: string;
    start: number;
    end: number;
    highlightIndex: number;
}

export interface SafeMarginConfig {
    topPercent: number;
    bottomPercent: number;
    leftPercent: number;
    rightPercent: number;
}

// Social media safe area margins (avoiding TikTok/Reels bottom and right side UI buttons)
export const SAFE_MARGINS: Record<string, SafeMarginConfig> = {
    vertical: {
        topPercent: 8,
        bottomPercent: 20, // 20% clearance for social media comment/like overlays
        leftPercent: 6,
        rightPercent: 12   // 12% clearance for right-side action buttons
    },
    horizontal: {
        topPercent: 6,
        bottomPercent: 10,
        leftPercent: 8,
        rightPercent: 8
    },
    square: {
        topPercent: 8,
        bottomPercent: 12,
        leftPercent: 6,
        rightPercent: 6
    }
};

// Normalizes word timestamps to prevent overlap and ensure min duration
export function normalizeCaptionTimings(
    words: CaptionWord[],
    clipStart: number,
    clipEnd: number,
    preferredMinimum = 0.15
): CaptionWord[] {
    if (!words || words.length === 0) return [];

    const safeStart = Math.max(0, Number(clipStart) || 0);
    const safeEnd = Math.max(safeStart + 0.2, Number(clipEnd) || safeStart + 0.2);

    const normalized = words
        .map(w => ({
            ...w,
            text: String(w.text || "").trim(),
            start: Math.max(safeStart, Math.min(safeEnd - 0.05, Number(w.start) || safeStart)),
            end: Math.max(safeStart + 0.05, Math.min(safeEnd, Number(w.end) || safeEnd))
        }))
        .filter(w => w.text.length > 0 && w.end > w.start)
        .sort((a, b) => a.start - b.start);

    for (let i = 0; i < normalized.length; i++) {
        const word = normalized[i];
        if (i < normalized.length - 1) {
            word.end = Math.min(word.end, normalized[i + 1].start);
        }
        if (word.end - word.start < preferredMinimum) {
            word.end = Math.min(safeEnd, word.start + preferredMinimum);
        }
    }

    return normalized;
}

// Builds 2-3 word animated sliding display windows for short-form video captions
export function getActiveCaptionWindow(
    subwords: CaptionWord[],
    currentTime: number,
    windowSize = 2
): CaptionWindow | null {
    if (!subwords || subwords.length === 0) return null;

    const activeIndex = subwords.findIndex(w => currentTime >= w.start && currentTime <= w.end);

    let displayWords: CaptionWord[] = [];
    let highlightIndex = -1;

    if (activeIndex !== -1) {
        const startIdx = activeIndex;
        const endIdx = Math.min(subwords.length - 1, activeIndex + windowSize - 1);
        displayWords = subwords.slice(startIdx, endIdx + 1);
        highlightIndex = 0;
    } else {
        const nextIdx = subwords.findIndex(w => w.start > currentTime);
        if (nextIdx !== -1) {
            const startIdx = nextIdx;
            const endIdx = Math.min(subwords.length - 1, nextIdx + windowSize - 1);
            displayWords = subwords.slice(startIdx, endIdx + 1);
            highlightIndex = -1;
        } else {
            displayWords = subwords.slice(Math.max(0, subwords.length - windowSize));
            highlightIndex = displayWords.length - 1;
        }
    }

    const text = displayWords.map(w => w.text).join(" ");
    const start = displayWords[0]?.start ?? currentTime;
    const end = displayWords[displayWords.length - 1]?.end ?? currentTime;

    return {
        words: displayWords,
        text,
        start,
        end,
        highlightIndex
    };
}
