// Importing modules
import { config } from "dotenv";

// loading environment variables
config();

// creating validated environment variables object
const env = {

    PORT: parseInt(process.env.PORT) || 5000,

    MONGO_URI: process.env.MONGO_URI || "mongodb://mongodb:27017/autoshorts",

    NODE_ENV: process.env.NODE_ENV || "development",

    LLM_PROVIDER: process.env.LLM_PROVIDER || "mistral",

    LLM_MODEL: process.env.LLM_MODEL || "",

    LLM_FALLBACK_PROVIDERS: process.env.LLM_FALLBACK_PROVIDERS || "groq,openrouter,ollama,deepseek,openai,gemini,claude",

    OLLAMA_HOST: process.env.OLLAMA_HOST || "http://host.docker.internal:11434",

    DEFAULT_CLIP_COUNT: parseInt(process.env.DEFAULT_CLIP_COUNT || "5") || 5,

    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "",

    GROQ_API_KEY: process.env.GROQ_API_KEY || "",

    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",

    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || "",




    // ─── Auth ────────────────────────────────────────────────────────────────

    // JWT secrets — change both in production!
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "change_me_access_secret",

    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "change_me_refresh_secret",

    // Frontend URL used in email links and Google OAuth callback
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

    // SMTP mail settings (set SEND_MAIL=true to actually send emails)
    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",

    SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,

    SMTP_USER: process.env.SMTP_USER || "",

    SMTP_PASS: process.env.SMTP_PASS || "",

    SENDING_USER: process.env.SENDING_USER || "AutoShorts <noreply@autoshorts.app>",

    SEND_MAIL: process.env.SEND_MAIL === "true",

    // Google OAuth credentials
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",

    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",

    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback",

    // Google Drive Storage settings
    GDRIVE_SERVICE_ACCOUNT_KEY: process.env.GDRIVE_SERVICE_ACCOUNT_KEY || "",

    GDRIVE_CENTRAL_FOLDER_ID: process.env.GDRIVE_CENTRAL_FOLDER_ID || ""

};


export default env;
