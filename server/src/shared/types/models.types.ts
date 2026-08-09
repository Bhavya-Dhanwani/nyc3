import { Document } from "mongoose";

export interface IWord {
    text: string;
    word?: string;
    start: number;
    end: number;
    speaker?: number;
    confidence?: number;
    punctuated_word?: string;
}

export interface ISegment {
    start: number;
    end: number;
    text: string;
    speaker?: number;
    words?: IWord[];
}

export interface IProject {
    name: string;
    originalName: string;
    sourcePath: string;
    status: "uploading" | "processing" | "ready" | "failed";
    sourceDuration?: number;
    captionStyle?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProjectDocument extends IProject, Document {}

export interface ITranscript {
    projectId: any;
    rawJson: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITranscriptDocument extends ITranscript, Document {}

export interface ICandidate {
    projectId: any;
    startSec: number;
    endSec: number;
    score: number;
    hook: string;
    rationale: string;
    rank: number;
    selected: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICandidateDocument extends ICandidate, Document {}

export interface IClip {
    projectId: any;
    candidateId: any;
    status: "pending" | "cutting" | "done" | "error";
    outputPath?: string;
    captionAssPath?: string;
    renderLog?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IClipDocument extends IClip, Document {}
