/**
 * Scoring thresholds and configuration for JD analysis.
 *
 * These can be overridden via environment variables in wrangler.toml:
 * - JAPANESE_HARD_CAP: Maximum score when Japanese fluency is required but not proven
 * - ONSITE_HARD_CAP: Maximum score when onsite work is required but profile prefers remote
 * - MAX_JD_CHARS: Maximum allowed characters for JD text input
 * - MAX_CONTENT_LENGTH: Maximum allowed HTTP content length in bytes
 * - AI_MODEL_ID: Model ID for Workers AI binding
 * - AI_ENABLED: Whether AI features are enabled
 */

export type ConfigEnv = {
  JAPANESE_HARD_CAP?: string;
  ONSITE_HARD_CAP?: string;
  MAX_JD_CHARS?: string;
  MAX_CONTENT_LENGTH?: string;
  AI_MODEL_ID?: string;
  AI_ENABLED?: string;
  ANALYZER_API_KEY?: string;
};

/** Default scoring thresholds */
export const DEFAULT_JAPANESE_HARD_CAP = 60;
export const DEFAULT_ONSITE_HARD_CAP = 70;
export const DEFAULT_MAX_JD_CHARS = 15_000;
export const DEFAULT_MAX_CONTENT_LENGTH = 30_000;
export const DEFAULT_AI_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";
export const DEFAULT_AI_ENABLED = true;

/**
 * Parse configuration from environment variables with fallback to defaults.
 */
export function parseConfig(env: ConfigEnv) {
  return {
    japaneseHardCap: parsePositiveInt(
      env.JAPANESE_HARD_CAP,
      DEFAULT_JAPANESE_HARD_CAP
    ),
    onsiteHardCap: parsePositiveInt(
      env.ONSITE_HARD_CAP,
      DEFAULT_ONSITE_HARD_CAP
    ),
    maxJdChars: parsePositiveInt(
      env.MAX_JD_CHARS,
      DEFAULT_MAX_JD_CHARS
    ),
    maxContentLength: parsePositiveInt(
      env.MAX_CONTENT_LENGTH,
      DEFAULT_MAX_CONTENT_LENGTH
    ),
    aiModelId: env.AI_MODEL_ID ?? DEFAULT_AI_MODEL_ID,
    aiEnabled: parseBoolean(env.AI_ENABLED, DEFAULT_AI_ENABLED),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const lower = value.toLowerCase().trim();
  if (lower === "true" || lower === "1" || lower === "yes") {
    return true;
  }
  if (lower === "false" || lower === "0" || lower === "no") {
    return false;
  }
  return fallback;
}
