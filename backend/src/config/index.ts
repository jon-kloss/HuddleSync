import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL || "",
  jwt: {
    secret: process.env.JWT_SECRET || "",
    expiry: process.env.JWT_EXPIRY || "15m",
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  whisperApiKey: process.env.WHISPER_API_KEY || "",
  diarizationServiceUrl: process.env.DIARIZATION_SERVICE_URL || "http://localhost:8000",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8081",
  nodeEnv: process.env.NODE_ENV || "development",

  get isDevelopment() {
    return this.nodeEnv === "development";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
} as const;

export function validateConfig(): void {
  const required: { key: string; value: string }[] = [
    { key: "DATABASE_URL", value: config.databaseUrl },
    { key: "JWT_SECRET", value: config.jwt.secret },
  ];

  const missing = required.filter((item) => !item.value);
  if (missing.length > 0) {
    const keys = missing.map((item) => item.key).join(", ");
    throw new Error(`Missing required environment variables: ${keys}`);
  }

  if (config.isProduction) {
    const productionRequired = [
      { key: "ANTHROPIC_API_KEY", value: config.anthropicApiKey },
      { key: "WHISPER_API_KEY", value: config.whisperApiKey },
    ];
    const missingProd = productionRequired.filter((item) => !item.value);
    if (missingProd.length > 0) {
      const keys = missingProd.map((item) => item.key).join(", ");
      throw new Error(`Missing required production environment variables: ${keys}`);
    }
  }
}

export default config;
