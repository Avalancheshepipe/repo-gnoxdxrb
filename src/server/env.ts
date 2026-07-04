// Centralized environment access. Intentionally does NOT import `server-only`
// so the worker / ws / bot Node processes can reuse it too.
// Values are read lazily with safe defaults; secrets are only required at the
// point of use (e.g. calling Vercel AI Gateway), never at import time.

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  APP_URL,
  PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? APP_URL,

  DATABASE_URL: process.env.DATABASE_URL ?? "",

  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? APP_URL,

  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  AI_GATEWAY_API_KEY:
    process.env.AI_GATEWAY_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "",
  AI_GATEWAY_DEFAULT_MODEL:
    process.env.AI_GATEWAY_DEFAULT_MODEL ??
    process.env.OPENROUTER_DEFAULT_MODEL ??
    "openai/gpt-4o-mini",
  AI_GATEWAY_STRONG_MODEL:
    process.env.AI_GATEWAY_STRONG_MODEL ??
    process.env.OPENROUTER_STRONG_MODEL ??
    "anthropic/claude-3.5-sonnet",
  AI_GATEWAY_TRANSCRIBE_MODEL:
    process.env.AI_GATEWAY_TRANSCRIBE_MODEL ??
    process.env.OPENROUTER_TRANSCRIBE_MODEL ??
    "google/gemini-2.5-flash",
  AI_GATEWAY_RESEARCH_MODEL:
    process.env.AI_GATEWAY_RESEARCH_MODEL ??
    process.env.OPENROUTER_RESEARCH_MODEL ??
    process.env.AI_GATEWAY_DEFAULT_MODEL ??
    "openai/gpt-4o-mini",
  AI_GATEWAY_DOC_MODEL:
    process.env.AI_GATEWAY_DOC_MODEL ??
    process.env.OPENROUTER_DOC_MODEL ??
    process.env.AI_GATEWAY_DEFAULT_MODEL ??
    "openai/gpt-4o-mini",
  /** Paid server STT via gateway — off by default (web uses Web Speech API). */
  VOICE_SERVER_TRANSCRIBE: bool(process.env.VOICE_SERVER_TRANSCRIBE, false),
  // Max search results pulled per web-research call (keeps tokens/cost down).
  RESEARCH_MAX_RESULTS: num(process.env.RESEARCH_MAX_RESULTS, 5),
  AGENT_MONTHLY_BUDGET_USD: num(process.env.AGENT_MONTHLY_BUDGET_USD, 25),

  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
  S3_REGION: process.env.S3_REGION ?? "ru-1",
  S3_BUCKET: process.env.S3_BUCKET ?? "julow",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
  S3_FORCE_PATH_STYLE: bool(process.env.S3_FORCE_PATH_STYLE, true),

  WS_PORT: num(process.env.WS_PORT, 1234),
  PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234",

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "",
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
} as const;

/** True when SMTP is configured enough to send real mail. */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

export function requireEnv(key: keyof typeof env): string {
  const value = env[key];
  if (value == null || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value);
}
