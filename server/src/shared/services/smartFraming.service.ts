// Importing modules
import logger from "../config/logger.config.js";

export interface BoundingBox {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
}

export interface FrameSubject {
    box: BoundingBox;
    face?: BoundingBox | null;
    label?: string;
    score?: number;
}

export interface FrameDimensions {
    width: number;
    height: number;
}

export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FramingResult {
    crop: CropRect;
    focusX: number; // 0 to 100 percentage
    focusY: number; // 0 to 100 percentage
    zoomFactor: number;
    ffmpegCropFilter: string;
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, Number(value) || 0));

class SmartFramingService {

    // normalizes a bounding box into 0..1 coordinate range
    normalizeBox(box: any): BoundingBox | null {
        if (!box) return null;
        const xMin = clamp(box.xMin ?? box.xmin ?? box.left);
        const yMin = clamp(box.yMin ?? box.ymin ?? box.top);
        const xMax = clamp(box.xMax ?? box.xmax ?? (box.left !== undefined && box.width !== undefined ? box.left + box.width : undefined));
        const yMax = clamp(box.yMax ?? box.ymax ?? (box.top !== undefined && box.height !== undefined ? box.top + box.height : undefined));
        if (xMax - xMin < 0.01 || yMax - yMin < 0.01) return null;
        return { xMin, yMin, xMax, yMax };
    }

    // normalizes subject properties
    normalizeSubject(subject: any): FrameSubject | null {
        const box = this.normalizeBox(subject?.box ?? subject);
        if (!box) return null;
        return {
            box,
            face: this.normalizeBox(subject?.face?.box ?? subject?.face),
            label: String(subject?.label || "person").toLowerCase(),
            score: clamp(subject?.score ?? 1.0)
        };
    }

    // infers head / face box if only upper body / person is detected
    inferHeadBox(subject: FrameSubject): BoundingBox | null {
        if (!subject?.box || subject.label !== "person") return null;
        const box = subject.box;
        const width = box.xMax - box.xMin;
        const height = box.yMax - box.yMin;
        const centerX = (box.xMin + box.xMax) / 2;
        const headWidth = Math.max(width * 0.5, height * 0.18);
        return this.normalizeBox({
            xMin: centerX - headWidth / 2,
            xMax: centerX + headWidth / 2,
            yMin: box.yMin - height * 0.42,
            yMax: box.yMin + height * 0.28
        });
    }

    // creates composition guide centered on subject's face / head
    getCompositionGuide(subjectInput: any) {
        const subject = this.normalizeSubject(subjectInput);
        if (!subject) return null;
        const head = subject.face || this.inferHeadBox(subject);
        const focus = head || subject.box;
        return {
            subject,
            head,
            focusX: (focus.xMin + focus.xMax) / 2,
            focusY: (focus.yMin + focus.yMax) / 2
        };
    }

    // gets largest proportional crop area for source and target dimensions
    getLargestCrop(sourceSize: FrameDimensions, targetSize: FrameDimensions): { width: number; height: number } {
        const sourceAspect = Math.max(0.01, Number(sourceSize?.width) || 1920) / Math.max(0.01, Number(sourceSize?.height) || 1080);
        const targetAspect = Math.max(0.01, Number(targetSize?.width) || 1080) / Math.max(0.01, Number(targetSize?.height) || 1920);
        const normalizedAspect = targetAspect / sourceAspect;
        if (normalizedAspect <= 1) return { width: normalizedAspect, height: 1 };
        return { width: 1, height: 1 / normalizedAspect };
    }

    // keeps subject inside safe boundaries without clipping edges
    keepSubjectInside(crop: CropRect, subjectInput: any, margin = 0.08): CropRect {
        const guide = this.getCompositionGuide(subjectInput);
        const subject = guide?.subject.box;
        if (!guide || !subject) return crop;
        const next = { ...crop };
        const subjectWidth = subject.xMax - subject.xMin;
        const subjectHeight = subject.yMax - subject.yMin;
        const marginX = next.width * margin;
        const marginY = next.height * margin;

        if (subjectWidth + marginX * 2 <= next.width) {
            if (subject.xMin < next.x + marginX) next.x = subject.xMin - marginX;
            if (subject.xMax > next.x + next.width - marginX) next.x = subject.xMax - next.width + marginX;
        }

        if (subjectHeight + marginY * 2 <= next.height) {
            if (subject.yMin < next.y + marginY) next.y = subject.yMin - marginY;
            if (subject.yMax > next.y + next.height - marginY) next.y = subject.yMax - next.height + marginY;
        }

        return {
            x: clamp(next.x, 0, 1 - next.width),
            y: clamp(next.y, 0, 1 - next.height),
            width: next.width,
            height: next.height
        };
    }

    // core smart framing algorithm from /bin/src/lib/smartFrame.js
    solveSmartFrameCrop(
        sourceSize: FrameDimensions,
        targetSize: FrameDimensions,
        subjectBox?: any,
        options: { padding?: number; maxZoom?: number; leadX?: number } = {}
    ): CropRect {
        const guide = this.getCompositionGuide(subjectBox);
        const subject = guide?.subject.box;
        const largest = this.getLargestCrop(sourceSize, targetSize);

        if (!subject || !guide) {
            return {
                x: (1 - largest.width) / 2,
                y: (1 - largest.height) / 2,
                width: largest.width,
                height: largest.height
            };
        }

        const padding = clamp(options.padding ?? 0.16, 0.04, 0.4);
        const requestedMaxZoom = Math.max(1, Math.min(2, Number(options.maxZoom) || 1.45));
        const normalizedAspect = largest.width / largest.height;
        const subjectWidth = subject.xMax - subject.xMin;
        const subjectHeight = subject.yMax - subject.yMin;
        const headHeight = guide.head ? guide.head.yMax - guide.head.yMin : 0;

        const shot = headHeight > 0.3
            ? "close"
            : subjectHeight >= 0.68 ? "full" : subjectHeight >= 0.38 ? "medium" : "wide";

        const desiredHeightOccupancy = shot === "close" ? 0.78 : shot === "full" ? 0.86 : shot === "medium" ? 0.72 : 0.62;
        const desiredWidthOccupancy = shot === "close" ? 0.72 : 0.78;
        const paddedHeightOccupancy = Math.max(0.48, desiredHeightOccupancy - padding * 0.22);
        const paddedWidthOccupancy = Math.max(0.5, desiredWidthOccupancy - padding * 0.18);
        const shotZoomLimit = shot === "close" ? 1.08 : shot === "full" ? 1.2 : shot === "medium" ? 1.35 : 1.55;
        const maxZoom = Math.min(requestedMaxZoom, shotZoomLimit);

        let height = Math.max(
            largest.height / maxZoom,
            subjectHeight / paddedHeightOccupancy,
            (subjectWidth / paddedWidthOccupancy) / normalizedAspect
        );
        let width = height * normalizedAspect;

        if (width > largest.width || height > largest.height) {
            width = largest.width;
            height = largest.height;
        }

        const rawCrop: CropRect = {
            x: guide.focusX - width / 2 + (Number(options.leadX) || 0),
            // Anchor head top to protect speaker's hair/headwear in portrait outputs
            y: guide.head ? guide.head.yMin - height * 0.055 : guide.focusY - height / 2,
            width,
            height
        };

        const normalizedCrop: CropRect = {
            x: clamp(rawCrop.x, 0, 1 - width),
            y: clamp(rawCrop.y, 0, 1 - height),
            width,
            height
        };

        return this.keepSubjectInside(normalizedCrop, guide.subject);
    }

    // calculates comprehensive framing parameters for rendering engines
    calculateFraming(
        sourceWidth = 1920,
        sourceHeight = 1080,
        aspectRatio: "vertical" | "horizontal" | "square" = "vertical",
        focusHint?: { focusX?: number; focusY?: number; zoomFactor?: number }
    ): FramingResult {
        const sourceSize: FrameDimensions = { width: sourceWidth, height: sourceHeight };
        let targetSize: FrameDimensions = { width: 1080, height: 1920 }; // 9:16

        if (aspectRatio === "horizontal") {
            targetSize = { width: 1920, height: 1080 }; // 16:9
        } else if (aspectRatio === "square") {
            targetSize = { width: 1080, height: 1080 }; // 1:1
        }

        let subjectBox: any = null;
        if (focusHint?.focusX !== undefined && focusHint?.focusY !== undefined) {
            const centerX = clamp(focusHint.focusX / 100);
            const centerY = clamp(focusHint.focusY / 100);
            const halfW = 0.15;
            const halfH = 0.25;
            subjectBox = {
                xMin: Math.max(0, centerX - halfW),
                xMax: Math.min(1, centerX + halfW),
                yMin: Math.max(0, centerY - halfH),
                yMax: Math.min(1, centerY + halfH)
            };
        }

        const crop = this.solveSmartFrameCrop(sourceSize, targetSize, subjectBox, {
            maxZoom: focusHint?.zoomFactor || 1.15
        });

        // Compute focus center percentage (0..100)
        const focusX = Math.round((crop.x + crop.width / 2) * 100);
        const focusY = Math.round((crop.y + crop.height / 2) * 100);
        const zoomFactor = focusHint?.zoomFactor || Math.max(1.0, Number((1 / crop.height).toFixed(2)));

        // Generate FFmpeg pixel crop filter expression
        const pixelCropW = Math.round(crop.width * sourceWidth);
        const pixelCropH = Math.round(crop.height * sourceHeight);
        const pixelCropX = Math.round(crop.x * sourceWidth);
        const pixelCropY = Math.round(crop.y * sourceHeight);

        const ffmpegCropFilter = `crop=${pixelCropW}:${pixelCropH}:${pixelCropX}:${pixelCropY}`;

        return {
            crop,
            focusX,
            focusY,
            zoomFactor,
            ffmpegCropFilter
        };
    }

}

export default SmartFramingService;
