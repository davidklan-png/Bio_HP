import { describe, expect, it } from "vitest";
import { analyzeJobDescription, STANDARD_RISK_FLAGS } from './analysis';

describe("Risk Flag Standardization", () => {
  const baseProfile = {
    skills: ["Python", "Prompt Engineering"],
    projects: [{
      name: "AI Implementation Project",
      tags: ["AI", "LLM"],
      summary: "Implemented AI solutions",
      outcomes: ["Improved efficiency"],
      stack: ["Python", "OpenAI"],
      evidence_urls: ["https://example.com/ai-project"]
    }],
    constraints: {
      location: "Remote",
      languages: ["English"],
      availability: "Full-time"
    }
  };

  it("Risk flag standardization uses standard names", () => {
    const jd = "Requirements:\n- Japanese fluency required\n- 5+ years Python experience";
    const result = analyzeJobDescription(jd, baseProfile, "risk-flag-test");

    // Check that risk flags use the standard name format: "STANDARD_NAME: message"
    const hasJapaneseFluencyFlag = result.risk_flags.some(f => f.startsWith("JAPANESE_FLUENCY:"));
    const hasLanguageMismatchFlag = result.risk_flags.some(f => f.startsWith("LANGUAGE_MISMATCH:"));

    expect(hasJapaneseFluencyFlag).toBe(true);
    expect(hasLanguageMismatchFlag).toBe(true);
  });

  it("should have STANDARD_RISK_FLAGS constant with all required flags", () => {
    expect(STANDARD_RISK_FLAGS.JAPANESE_FLUENCY).toBe("JAPANESE_FLUENCY");
    expect(STANDARD_RISK_FLAGS.ONSITE_REQUIRED).toBe("ONSITE_REQUIRED");
    expect(STANDARD_RISK_FLAGS.LANGUAGE_MISMATCH).toBe("LANGUAGE_MISMATCH");
    expect(STANDARD_RISK_FLAGS.CONTRACT_ONLY).toBe("CONTRACT_ONLY");
    expect(STANDARD_RISK_FLAGS.LOCATION_MISMATCH).toBe("LOCATION_MISMATCH");
    expect(STANDARD_RISK_FLAGS.CONTRACT_AVAILABILITY).toBe("CONTRACT_AVAILABILITY");
  });

  it("ONSITE_REQUIRED flag is generated for onsite requirements with remote preference", () => {
    const jd = "Requirements:\n- Onsite only - no remote\n- Python experience";
    const result = analyzeJobDescription(jd, baseProfile, "onsite-test");

    expect(result.risk_flags.some(f => f.startsWith("ONSITE_REQUIRED:"))).toBe(true);
  });
});
