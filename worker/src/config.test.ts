import { describe, expect, it } from "vitest";
import {
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
      maxContentLength: DEFAULT_MAX_CONTENT_LENGTH
    });
  });

  it("uses numeric overrides when provided", () => {
    const parsed = parseConfig({
      JAPANESE_HARD_CAP: "55",
      ONSITE_HARD_CAP: "65",
      MAX_JD_CHARS: "12000",
      MAX_CONTENT_LENGTH: "25000"
    });
    expect(parsed).toEqual({
      japaneseHardCap: 55,
      onsiteHardCap: 65,
      maxJdChars: 12000,
      maxContentLength: 25000
    });
  });

  it("falls back to defaults for invalid override values", () => {
    const parsed = parseConfig({
      JAPANESE_HARD_CAP: "-1",
      ONSITE_HARD_CAP: "NaN",
      MAX_JD_CHARS: "0",
      MAX_CONTENT_LENGTH: "invalid"
    });
    expect(parsed).toEqual({
      japaneseHardCap: DEFAULT_JAPANESE_HARD_CAP,
      onsiteHardCap: DEFAULT_ONSITE_HARD_CAP,
      maxJdChars: DEFAULT_MAX_JD_CHARS,
      maxContentLength: DEFAULT_MAX_CONTENT_LENGTH
    });
  });
});
