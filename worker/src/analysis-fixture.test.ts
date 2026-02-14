import { describe, expect, it, beforeAll } from "vitest";
import { analyzeJobDescription, type Profile, validateAnalyzeBody } from "./analysis";
import { readFileSync } from "fs";
import { join } from "path";

// Load the fixture JD
const fixtureJD = readFileSync(
  join(__dirname, "../testdata/jd_cosmetics_enablement.txt"),
  "utf-8"
);

// Load the expected properties
const expectedProperties = JSON.parse(
  readFileSync(
    join(__dirname, "../testdata/expected_properties.json"),
    "utf-8"
  )
);

// Bilingual profile (matches requirements)
const bilingualProfile: Profile = {
  skills: [
    "Python",
    "TypeScript",
    "LLM application architecture",
    "RAG",
    "Prompt engineering",
    "Evaluation and observability",
    "Infrastructure transformation",
    "Data migration",
    "Program governance",
    "Change management",
    "Enterprise delivery",
    "Stakeholder management",
    "DR/BCP delivery",
    "PMO reporting",
    "Cross-region team leadership",
    "Compliance and risk management"
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
      stack: ["Python", "Vector search", "LLM APIs", "Jekyll"],
      evidence_urls: [
        "https://kinokoholic.com/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/"
      ]
    },
    {
      name: "GenAI Enablement and Change Leadership",
      tags: [
        "Change management",
        "Enablement",
        "Training",
        "Stakeholder communication",
        "Digital transformation"
      ],
      summary: "Cross-functional delivery leadership focused on adoption, enablement, and enterprise transformation outcomes.",
      outcomes: [
        "Created governance and steering reporting across scope, schedule, budget, and risk",
        "Led stakeholder alignment and vendor coordination for complex delivery programs",
        "Applied structured communication and adoption plans across multi-team initiatives"
      ],
      stack: ["Program management", "Governance", "Risk management", "Communication"],
      evidence_urls: [
        "https://kinokoholic.com/work-history/"
      ]
    }
  ],
  constraints: {
    location: "United States and Japan (open to remote and hybrid)",
    languages: ["English (Native)", "Japanese (Business)"],
    availability: "Open to full-time, consulting, or advisory AI/IT delivery roles"
  }
};

// Profile without Japanese (for testing hard gates)
const noJapaneseProfile: Profile = {
  ...bilingualProfile,
  constraints: {
    location: "United States (remote)",
    languages: ["English (Native)"],
    availability: "Open to full-time roles"
  }
};

describe("Milestone 0: Regression fixture test", () => {
  it("validates the fixture JD itself", () => {
    const validationError = validateAnalyzeBody({ jd_text: fixtureJD });
    expect(validationError).toBeNull();
  });

  it("Invariant #1: No JD text as evidence source", () => {
    const result = analyzeJobDescription(fixtureJD, bilingualProfile, "fixture-test-1");

    // Check that all strengths have valid evidence URLs from profile
    for (const strength of result.strengths) {
      // Evidence URL must be from a known project in the profile
      const isProfileEvidence = bilingualProfile.projects.some(
        p => p.evidence_urls.includes(strength.evidence_url)
      );
      expect(isProfileEvidence).toBe(true);
    }

    // Check that rationale doesn't quote large chunks of JD text
    for (const strength of result.strengths) {
      // Rationale should be concise, not a copy-paste of JD lines
      expect(strength.rationale.length).toBeLessThan(150);
    }
  });

  it("Invariant #2: Capacity is a constraint, not a responsibility gap", () => {
    const result = analyzeJobDescription(fixtureJD, bilingualProfile, "fixture-test-2");

    // "Capacity" should not appear as a gap
    const capacityGaps = result.gaps.filter(
      g => g.area.toLowerCase().includes("capacity") ||
           g.why_it_matters.toLowerCase().includes("capacity")
    );
    expect(capacityGaps.length).toBe(0);
  });

  it("Invariant #3: Languages extracted and validated", () => {
    const result = analyzeJobDescription(fixtureJD, bilingualProfile, "fixture-test-3");

    // With bilingual profile, should not have language risk flags for Japanese
    const japaneseLanguageRisk = result.risk_flags.filter(
      f => f.toLowerCase().includes("japanese") && f.toLowerCase().includes("no evidence")
    );
    expect(japaneseLanguageRisk.length).toBe(0);
  });

  it("Invariant #4: Domain fit not from generic tokens", () => {
    const result = analyzeJobDescription(fixtureJD, bilingualProfile, "fixture-test-4");

    // Find domain fit rubric item
    const domainFit = result.rubric_breakdown.find(r => r.category.toLowerCase().includes("domain"));
    expect(domainFit).toBeDefined();

    // Domain fit notes should NOT claim matches for generic tokens like python/prompt
    if (domainFit) {
      const notes = domainFit.notes.toLowerCase();
      // These generic tokens should not contribute to domain fit
      // Domain fit should be about cosmetics/beauty/CPG/retail context
      if (notes.includes("matched") || notes.includes("domain terms")) {
        // If it claims matches, verify they're NOT generic tech tokens
        expect(notes).not.toContain("python");
        expect(notes).not.toContain("prompt");
        expect(notes).not.toContain("japanese");
      }
    }
  });

  it("Additional check: No gaps for Languages heading", () => {
    const result = analyzeJobDescription(fixtureJD, bilingualProfile, "fixture-test-5");

    // Should not have gaps like "No evidence found for: Languages:"
    const headingGaps = result.gaps.filter(g => {
      const lower = g.why_it_matters.toLowerCase();
      return expectedProperties.invariants.should_not_see_in_gaps.some(
        forbidden => lower.includes(forbidden.toLowerCase())
      );
    });
    expect(headingGaps.length).toBe(0);
  });

  it("Japanese hard gate is properly triggered when missing from profile", () => {
    const result = analyzeJobDescription(fixtureJD, noJapaneseProfile, "fixture-test-6");

    // Should have Japanese fluency hard gate
    const hasJapaneseHardCap = result.risk_flags.some(
      f => f.toLowerCase().includes("japanese") && f.toLowerCase().includes("hard gate")
    );
    expect(hasJapaneseHardCap).toBe(true);
    expect(result.score).toBeLessThanOrEqual(60);
  });
});
