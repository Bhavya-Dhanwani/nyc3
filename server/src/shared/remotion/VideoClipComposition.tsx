import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig } from "remotion";
import React from "react";
import { loadFont } from "@remotion/google-fonts/Anton";

const { fontFamily } = loadFont();

export const VideoClipComposition = ({
    videoUrl,
    startSec,
    endSec,
    subwords = [],
    stylePreset = "modern-box",
    captionSettings = {},
    isPreCut = false,
    layout = "standard",
    zoomFactor = 1.0,
    focusX = 50,
    focusY = 50,
    aspectRatio = "vertical"
}: any) => {

    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = startSec + frame / fps;

    // find active word
    const activeIndex = subwords.findIndex((w: any) => currentTime >= w.start && currentTime <= w.end);

    // fall back to closest word if no exact word matches (e.g. pauses between words)
    let displayWords: any[] = [];
    let highlightIndexInWindow = -1;

    if (activeIndex !== -1) {
        // Show active word and next word (2 words window for Reels/Shorts style)
        const startIdx = activeIndex;
        const endIdx = Math.min(subwords.length - 1, activeIndex + 1);
        displayWords = subwords.slice(startIdx, endIdx + 1);
        highlightIndexInWindow = 0;
    }
    else {
        // find the next upcoming word
        const nextIdx = subwords.findIndex((w: any) => w.start > currentTime);

        if (nextIdx !== -1) {
            const startIdx = nextIdx;
            const endIdx = Math.min(subwords.length - 1, nextIdx + 1);
            displayWords = subwords.slice(startIdx, endIdx + 1);
        }
        else if (subwords.length > 0) {
            // fallback to last word
            displayWords = subwords.slice(subwords.length - 1);
        }
    }

    const isHorizontal = aspectRatio === "horizontal";
    const isSquare = aspectRatio === "square";

    // Dynamic Font Size adjustment based on text length to prevent overflow
    const combinedText = displayWords.map((w: any) => w.text).join(" ");
    let baseFontSize = isHorizontal ? 52 : isSquare ? 58 : 72;
    if (combinedText.length > 25) {
        baseFontSize = isHorizontal ? 34 : isSquare ? 38 : 48;
    } else if (combinedText.length > 15) {
        baseFontSize = isHorizontal ? 42 : isSquare ? 48 : 58;
    }

    // determine styles based on stylePreset
    let textStyle = {
        fontFamily: `${fontFamily}, Impact, Arial Black, sans-serif`,
        fontSize: `${baseFontSize}px`,
        textTransform: "uppercase" as const,
        textAlign: "center" as const,
        padding: "10px 20px",
        lineHeight: "1.2",
        wordBreak: "break-word" as const
    };

    // Safe margins: keep 24% clearance from bottom for vertical Reels/TikTok UI buttons
    let containerStyle = {
        position: "absolute" as const,
        bottom: isHorizontal ? "10%" : isSquare ? "15%" : "24%",
        left: isHorizontal ? "8%" : "6%",
        right: isHorizontal ? "8%" : "12%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap" as const,
        gap: "15px",
        zIndex: 20
    };

    const getWordStyle = (isHighlighted: boolean) => {

        let style: React.CSSProperties = {
            transition: "transform 0.1s ease-in-out",
            transform: isHighlighted ? "scale(1.2)" : "scale(1.0)"
        };

        if (stylePreset === "modern-box") {
            style = {
                ...style,
                color: isHighlighted ? "#ffeb3b" : "#ffffff",
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                borderRadius: "8px",
                padding: "8px 16px"
            };
        }
        else if (stylePreset === "classic-outline") {
            style = {
                ...style,
                color: isHighlighted ? "#ffeb3b" : "#ffffff",
                WebkitTextStroke: "4px #000000",
                textShadow: "2px 2px 0px #000000"
            };
        }
        else if (stylePreset === "minimal-shadow") {
            style = {
                ...style,
                color: isHighlighted ? "#00e5ff" : "#ffffff",
                textShadow: "3px 3px 6px rgba(0, 0, 0, 0.9)"
            };
        }
        else if (stylePreset === "vibrant-cyan") {
            style = {
                ...style,
                color: isHighlighted ? "#00ffff" : "#e0f7fa",
                WebkitTextStroke: "3px #000000",
                textShadow: "4px 4px 0px #000000"
            };
        }
        else if (stylePreset === "vibrant-yellow-box") {
            style = {
                ...style,
                color: isHighlighted ? "#000000" : "#212121",
                backgroundColor: isHighlighted ? "#ffeb3b" : "rgba(255, 255, 255, 0.9)",
                borderRadius: "4px",
                padding: "6px 12px",
                boxShadow: "4px 4px 0px #000000"
            };
        }
        else if (stylePreset === "vibrant-green") {
            style = {
                ...style,
                color: isHighlighted ? "#39ff14" : "#ffffff",
                WebkitTextStroke: "3px #000000",
                textShadow: "3px 3px 0px #000000"
            };
        }
        else if (stylePreset === "vibrant-red") {
            style = {
                ...style,
                color: isHighlighted ? "#ff1744" : "#ffffff",
                backgroundColor: isHighlighted ? "rgba(255, 23, 68, 0.2)" : "rgba(0,0,0,0.5)",
                WebkitTextStroke: "2px #000000",
                borderRadius: "4px",
                padding: "6px 12px"
            };
        }
        else if (stylePreset === "tiktok-bounce") {
            style = {
                ...style,
                color: isHighlighted ? "#00f2fe" : "#ffffff",
                WebkitTextStroke: "3px #000000",
                textShadow: isHighlighted ? "0 0 15px #4facfe" : "2px 2px 0 #000",
                transform: isHighlighted ? "scale(1.25) rotate(-2deg)" : "scale(1.0)"
            };
        }
        else if (stylePreset === "karaoke-glow") {
            style = {
                ...style,
                color: isHighlighted ? "#ffe600" : "#ffffff",
                backgroundColor: isHighlighted ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.45)",
                boxShadow: isHighlighted ? "0 0 20px #ffe600" : "none",
                borderRadius: "6px",
                padding: "6px 14px"
            };
        }

        return style;
    };

    const canvasWidth = isHorizontal ? 1920 : 1080;
    const canvasHeight = isHorizontal ? 1080 : isSquare ? 1080 : 1920;

    const videoProps = {
        src: videoUrl,
        startFrom: isPreCut ? 0 : Math.floor(startSec * fps),
        endAt: isPreCut ? Math.ceil((endSec - startSec) * fps) : Math.ceil(endSec * fps),
        style: {
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            objectFit: "cover" as const
        }
    };

    const renderLayout = () => {
        if (isHorizontal) {
            return (
                <div style={{ width: "1920px", height: "1080px", overflow: "hidden", position: "relative" }}>
                    <Video
                        {...videoProps}
                        style={{
                            width: "1920px",
                            height: "1080px",
                            objectFit: "cover"
                        }}
                    />
                </div>
            );
        }

        if (layout === "split-screen") {
            return (
                <div style={{ display: "flex", flexDirection: "column", width: "1080px", height: "1920px" }}>
                    {/* Top Portion: Presenter/Speaker */}
                    <div style={{ width: "1080px", height: "800px", overflow: "hidden", position: "relative", borderBottom: "8px solid #ffeb3b" }}>
                        <Video
                            {...videoProps}
                            style={{
                                width: "1080px",
                                height: "1920px",
                                objectFit: "cover",
                                objectPosition: "95% 95%",
                                position: "absolute",
                                top: "-400px"
                            }}
                        />
                    </div>
                    {/* Bottom Portion: Screen Share */}
                    <div style={{ width: "1080px", height: "1120px", overflow: "hidden", position: "relative" }}>
                        <Video
                            {...videoProps}
                            style={{
                                width: "1080px",
                                height: "1920px",
                                objectFit: "cover",
                                objectPosition: "20% 50%",
                                position: "absolute",
                                top: "-300px"
                            }}
                        />
                    </div>
                </div>
            );
        }

        if (layout === "pip") {
            return (
                <div style={{ width: "1080px", height: "1920px", position: "relative" }}>
                    {/* Background: Screen share */}
                    <Video
                        {...videoProps}
                        style={{
                            width: "1080px",
                            height: "1920px",
                            objectFit: "cover",
                            objectPosition: "20% 50%"
                        }}
                    />
                    {/* Floating circular presenter badge */}
                    <div style={{
                        position: "absolute",
                        bottom: "35%",
                        right: "60px",
                        width: "320px",
                        height: "320px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "8px solid #ffffff",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        zIndex: 10
                    }}>
                        <Video
                            {...videoProps}
                            style={{
                                width: "1080px",
                                height: "1920px",
                                objectFit: "cover",
                                objectPosition: "95% 95%",
                                transform: "scale(2.2)",
                                transformOrigin: "95% 95%"
                            }}
                        />
                    </div>
                </div>
            );
        }

        // Standard or Smart-Framing Zoom-focus layout
        const pctX = focusX !== undefined ? focusX : 50;
        const pctY = focusY !== undefined ? focusY : 50;
        const effectiveZoom = zoomFactor || 1.0;

        return (
            <div style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, overflow: "hidden", position: "relative" }}>
                <Video
                    {...videoProps}
                    style={{
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                        objectFit: "cover",
                        transform: `scale(${effectiveZoom}) translate(${50 - pctX}%, ${50 - pctY}%)`,
                        transformOrigin: "center center"
                    }}
                />
            </div>
        );
    };

    return (
        <AbsoluteFill style={{ backgroundColor: "#000000" }}>
            {renderLayout()}

            {/* Subtitles Overlay */}
            <div style={containerStyle}>
                {displayWords.map((w: any, idx: number) => {
                    const isHighlighted = idx === highlightIndexInWindow;
                    return (
                        <span
                            key={idx}
                            style={{
                                ...textStyle,
                                ...getWordStyle(isHighlighted)
                            }}
                        >
                            {w.text}
                        </span>
                    );
                })}
            </div>
        </AbsoluteFill>
    );

};


