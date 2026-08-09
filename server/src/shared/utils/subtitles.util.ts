// Importing modules
import fs from "fs";
import path from "path";

// function to format srt timestamps (hh:mm:ss,ms)
function formatSrtTime(secs) {

    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const secsOnly = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);

    const pad = (num, size) => num.toString().padStart(size, "0");

    return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(secsOnly, 2)},${pad(ms, 3)}`;

}

// function to generate SRT subtitle file content
export function generateSrt(words, startSec, endSec) {

    let srt = "";
    let index = 1;

    // filtering words that overlap with clip duration
    const candidateWords = words.filter(w => w.end > startSec && w.start < endSec);

    // grouping in chunks of 3 words
    for (let i = 0; i < candidateWords.length; i += 3) {

        const chunk = candidateWords.slice(i, i + 3);

        if (chunk.length === 0) {

            continue;

        }

        const first = chunk[0];
        const last = chunk[chunk.length - 1];

        // calculating relative timestamps
        const startRel = Math.max(first.start - startSec, 0.0);
        const endRel = Math.max(Math.min(last.end - startSec, endSec - startSec), 0.0);

        const text = chunk.map(w => w.text).join(" ");

        srt += `${index}\n`;
        srt += `${formatSrtTime(startRel)} --> ${formatSrtTime(endRel)}\n`;
        srt += `${text}\n\n`;

        index++;

    }

    return srt;

}

// function to build FFmpeg drawtext filter graph for captions overlays
export function buildDrawtextFilters(words, startSec, endSec, croppedWidth, captionStyle) {

    const drawtextFilters = [];

    // filtering words overlapping with clip duration
    const candidateWords = words.filter(w => w.end > startSec && w.start < endSec);

    // standard font file paths to search (matching system OS and Docker layers)
    const fontPaths = [
        // Docker Debian / Ubuntu font path
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        // macOS path
        "/System/Library/Fonts/Supplemental/Futura.ttc",
        "/System/Library/Fonts/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        // Windows path
        "C:/Windows/Fonts/SegoeUIb.ttf",
        "C:/Windows/Fonts/arialbd.ttf"
    ];

    let fontOption = "";

    for (const fPath of fontPaths) {

        if (fs.existsSync(fPath)) {

            // escape path backslashes and colons for ffmpeg filtergraph parsing
            const escaped = fPath
                .replace(/\\/g, "\\\\")
                .replace(/:/g, "\\:")
                .replace(/'/g, "\\'")
                .replace(/ /g, "\\ ");

            fontOption = `fontfile=${escaped}:`;
            break;

        }

    }

    // grouping in chunks of 2 words for rapid fast-paced caption style
    for (let i = 0; i < candidateWords.length; i += 2) {

        const chunk = candidateWords.slice(i, i + 2);

        if (chunk.length === 0) {

            continue;

        }

        const first = chunk[0];
        const last = chunk[chunk.length - 1];

        const startRel = first.start;
        const endRel = last.end;

        if (endRel <= startRel) {

            continue;

        }

        const text = chunk.map(w => w.text.toUpperCase()).join(" ");

        // clean text to avoid breaking filter graph parser parameters
        const cleanText = text.replace(/[^A-Z0-9 !?]/g, "");

        // sizing parameters matching video width
        const fontsize = Math.round(Math.max(Math.min(croppedWidth * 0.075, 80.0), 16.0));
        const padding = Math.round(Math.max(Math.min(fontsize * 0.3, 24.0), 4.0));

        let drawtext = "";

        switch (captionStyle) {

            case "classic-outline": {

                const borderw = Math.round(Math.max(Math.min(fontsize * 0.1, 8.0), 2.0));
                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.65:fontsize=${fontsize}:fontcolor=yellow:borderw=${borderw}:bordercolor=black:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            case "minimal-shadow": {

                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.7:fontsize=${fontsize}:fontcolor=white:shadowcolor=black@0.5:shadowx=2:shadowy=2:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            case "vibrant-cyan": {

                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.7:fontsize=${fontsize}:fontcolor=0x00FFFF:shadowcolor=black@0.6:shadowx=2:shadowy=2:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            case "vibrant-yellow-box": {

                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.72:fontsize=${fontsize}:fontcolor=black:box=1:boxcolor=0xffff00e0:boxborderw=${padding}:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            case "vibrant-green": {

                const borderw = Math.round(Math.max(Math.min(fontsize * 0.08, 6.0), 1.5));
                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.7:fontsize=${fontsize}:fontcolor=0x39FF14:borderw=${borderw}:bordercolor=black:shadowcolor=black@0.6:shadowx=2:shadowy=2:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            case "vibrant-red": {

                const borderw = Math.round(Math.max(Math.min(fontsize * 0.08, 6.0), 1.5));
                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.7:fontsize=${fontsize}:fontcolor=0xFF3B30:borderw=${borderw}:bordercolor=black:shadowcolor=black@0.6:shadowx=2:shadowy=2:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

            default: { // modern-box

                drawtext = `drawtext=${fontOption}text='${cleanText}':x=(w-text_w)/2:y=h*0.72:fontsize=${fontsize}:fontcolor=white:box=1:boxcolor=0x000000b0:boxborderw=${padding}:enable='between(t,${startRel.toFixed(3)},${endRel.toFixed(3)})'`;
                break;

            }

        }

        drawtextFilters.push(drawtext);

    }

    return drawtextFilters.join(",");

}
