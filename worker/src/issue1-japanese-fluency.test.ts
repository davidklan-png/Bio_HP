/**
 * Failing unit tests for Issue 1: Japanese Fluency Hard Cap
 *
 * These tests should fail initially, then pass after fixes are implemented.
 * Following TDD: Red → Green → Refactor
 */

import { describe, expect, it } from "vitest";
import { analyzeJobDescription } from './analysis';

describe("Issue 1: Japanese Fluency Hard Cap", () => {
  const baseProfile = {
    skills: [
      "Python",
      "TypeScript",
      "LLM application architecture",
      "RAG",
      "Prompt engineering",
      "Program governance",
      "Stakeholder management"
    ],
    projects: [
      {
        name: "Japanese Tax Expert System (JTES)",
        tags: ["RAG", "Tax domain", "Citation grounding"],
        summary: "Specialized retrieval-augmented assistant for Japanese tax workflows.",
        outcomes: [
          "Built evidence-grounded answer flow with citations",
          "Improved retrieval relevance using domain-specific chunking"
        ],
        stack: ["Python", "Vector search", "LLM APIs"],
        evidence_urls: ["https://kinokoholic.com/projects/jtes/"]
      },
      {
        name: "Infrastructure Scale and DR/BCP Delivery",
        tags: ["DR/BCP", "Infrastructure", "Program governance"],
        summary: "Delivered infrastructure transformation across Japan, EMEA, and North America.",
        outcomes: [
          "Managed 10,000+ clients across 400+ servers",
          "Directed post-merger infrastructure standardization"
        ],
        stack: ["Windows Server", "Project governance"],
        evidence_urls: ["https://kinokoholic.com/work-history/"]
      }
    ],
    constraints: {
      location: "United States and Japan (open to remote and hybrid)",
      languages: ["English (Native)", "Japanese (Business)"],
      availability: "Open to full-time, consulting, or advisory roles"
    }
  };

  it("TC001: JLPT N1 pattern triggers hard cap at 60", () => {
    const jd = [
      "Position: AI Technical Lead",
      "Company: Tokyo Tech Innovations",
      "Location: Tokyo, Japan",
      "",
      "Responsibilities:",
      "- Lead AI/ML initiatives for enterprise clients",
      "- Design and implement RAG systems",
      "",
      "Requirements:",
      "- 5+ years experience with LLM applications",
      "- Strong Python and TypeScript skills",
      "- Japanese fluency required (JLPT N1 or equivalent)"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC001");

    console.log("TC001 DEBUG - Score:", result.score, "Risk flags:", JSON.stringify(result.risk_flags));
    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.confidence).toBe("Low");
    // Risk flag should contain "JAPANESE_FLUENCY" (standardized format)
    expect(result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY"))).toBe(true);
  });

  it("TC003: Native or fluent pattern triggers hard cap at 60", () => {
    const jd = [
      "Position: Technical Project Manager",
      "Company: Tech Corporation",
      "Location: Tokyo",
      "",
      "Requirements:",
      "- 5+ years project management experience",
      "- Native or fluent Japanese language skills required",
      "- Stakeholder management experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC003");

    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.confidence).toBe("Low");
    expect(result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY"))).toBe(true);
  });

  it("TC005: Professional Japanese pattern triggers hard cap at 60", () => {
    const jd = [
      "Position: AI Consultant",
      "Company: Global AI Solutions",
      "Location: Tokyo",
      "",
      "Requirements:",
      "- 7+ years AI/ML consulting experience",
      "- Professional Japanese required (JLPT N1-N2 equivalent)",
      "- Change management and enablement skills"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC005");

    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.confidence).toBe("Low");
    expect(result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY"))).toBe(true);
  });

  it("TC013: Profile has Japanese (Business) but JD doesn't mention Japanese - should NOT trigger hard cap", () => {
    const jd = [
      "Position: AI Project Manager",
      "Company: Global Tech",
      "Location: New York, NY",
      "",
      "Responsibilities:",
      "- Manage AI/ML implementation projects",
      "- Coordinate stakeholder relationships",
      "- Lead change management initiatives",
      "",
      "Requirements:",
      "- 5+ years project management experience",
      "- Program governance experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC013");

    // This should NOT trigger hard cap because profile's "Japanese (Business)" is just
    // stating language capability, not a requirement. JD doesn't mention Japanese at all.
    // Score should be higher since PM skills match well.
    expect(result.score).toBeGreaterThan(60);
    expect(result.confidence).not.toBe("Low"); // Should be Medium or High
  });
});
