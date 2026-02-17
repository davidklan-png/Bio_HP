import { describe, expect, it } from "vitest";

describe("Absolute Path Test", () => {
  it("should load analysis from absolute path", async () => {
    const analysis = await import('./analysis');
    const testProfile = {
      skills: ["Python"],
      projects: [{
        name: "Test Project",
        tags: ["test"],
        summary: "Test summary",
        outcomes: ["Test outcome"],
        stack: ["Python"],
        evidence_urls: ["https://example.com/test"]
      }],
      constraints: {
        location: "Remote",
        languages: ["English"],
        availability: "Full-time"
      }
    };

    const jd = "Requirements:\n- Japanese fluency required (JLPT N1)";
    const result = analysis.analyzeJobDescription(jd, testProfile, "test");
    console.log("Risk flags:", result.risk_flags);
    console.log("Has JAPANESE_FLUENCY:", result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY")));
  });
});
