/**
 * Scoring thresholds and configuration for JD analysis.
 *
 * These can be overridden via environment variables in wrangler.toml:
 * - JAPANESE_HARD_CAP: Maximum score when Japanese fluency is required but not proven
 * - ONSITE_HARD_CAP: Maximum score when onsite work is required but profile prefers remote
 * - MAX_JD_CHARS: Maximum allowed characters for JD text input
 * - MAX_CONTENT_LENGTH: Maximum allowed HTTP content length in bytes
 */

export type ConfigEnv = {
  JAPANESE_HARD_CAP?: string;
  ONSITE_HARD_CAP?: string;
  MAX_JD_CHARS?: string;
  MAX_CONTENT_LENGTH?: string;
};

/** Default scoring thresholds */
export const DEFAULT_JAPANESE_HARD_CAP = 60;
export const DEFAULT_ONSITE_HARD_CAP = 70;
export const DEFAULT_MAX_JD_CHARS = 15_000;
export const DEFAULT_MAX_CONTENT_LENGTH = 30_000;

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
