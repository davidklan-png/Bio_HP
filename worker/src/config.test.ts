import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_ENABLED,
  DEFAULT_AI_MODEL_ID,
  DEFAULT_JAPANESE_HARD_CAP,
  DEFAULT_MAX_CONTENT_LENGTH,
  DEFAULT_MAX_JD_CHARS,
  DEFAULT_ONSITE_HARD_CAP,
  parseConfig
} from "./config";

describe("config parser", () => {
  it("uses defaults when env vars are missing", () => {
    const parsed = parseConfig({});
    expect(parsed).toEqual({
      japaneseHardCap: DEFAULT_JAPANESE_HARD_CAP,
      onsiteHardCap: DEFAULT_ONSITE_HARD_CAP,
      maxJdChars: DEFAULT_MAX_JD_CHARS,
      maxContentLength: DEFAULT_MAX_CONTENT_LENGTH,
      aiModelId: DEFAULT_AI_MODEL_ID,
      aiEnabled: DEFAULT_AI_ENABLED
    });
  });

  it("uses numeric overrides when provided", () => {
    const parsed = parseConfig({
      JAPANESE_HARD_CAP: "55",
      ONSITE_HARD_CAP: "65",
      MAX_JD_CHARS: "12000",
      MAX_CONTENT_LENGTH: "25000",
      AI_MODEL_ID: "@cf/meta/llama-3.2-3b-instruct",
      AI_ENABLED: "false"
    });
    expect(parsed).toEqual({
      japaneseHardCap: 55,
      onsiteHardCap: 65,
      maxJdChars: 12000,
      maxContentLength: 25000,
      aiModelId: "@cf/meta/llama-3.2-3b-instruct",
      aiEnabled: false
    });
  });

  it("falls back to defaults for invalid override values", () => {
    const parsed = parseConfig({
      JAPANESE_HARD_CAP: "-1",
      ONSITE_HARD_CAP: "NaN",
      MAX_JD_CHARS: "0",
      MAX_CONTENT_LENGTH: "invalid",
      AI_ENABLED: "maybe"
    });
    expect(parsed).toEqual({
      japaneseHardCap: DEFAULT_JAPANESE_HARD_CAP,
      onsiteHardCap: DEFAULT_ONSITE_HARD_CAP,
      maxJdChars: DEFAULT_MAX_JD_CHARS,
      maxContentLength: DEFAULT_MAX_CONTENT_LENGTH,
      aiModelId: DEFAULT_AI_MODEL_ID,
      aiEnabled: DEFAULT_AI_ENABLED
    });
  });
});
