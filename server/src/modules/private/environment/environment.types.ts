export interface IEnvironmentInfo {
    hasFfmpeg: boolean;
    hasFfprobe: boolean;
    ollamaStatus: "connected" | "disconnected";
    ollamaModels: string[];
    deepgramApiKeyConfigured: boolean;
    groqApiKeyConfigured: boolean;
    openaiApiKeyConfigured: boolean;
    anthropicApiKeyConfigured: boolean;
    selectedModel: string;
    selectedService: string;
}
