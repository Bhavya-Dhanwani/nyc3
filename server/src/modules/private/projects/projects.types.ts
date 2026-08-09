export interface ICreateProjectRequest {
    name: string;
    transcriptionMode?: "local" | "deepgram";
    captionStyle?: string;
}

export interface IProjectDetailResponse {
    project: any;
    transcript: any;
    candidates: any[];
    clips: any[];
}
