import { describe, expect, it } from "vitest";
import {
  analyzeJobDescription,
  buildRateLimitErrorPayload,
  calculateConfidence,
  type Profile,
  validateAnalyzeBody,
  validateAnalyzeBodyWithLimit
} from "./analysis";

const baseProfile: Profile = {
  skills: ["Python", "RAG", "Prompt engineering", "Enablement"],
  projects: [
    {
      name: "AI Enablement Program",
      tags: ["RAG", "enablement", "workflows", "modernization"],
      summary: "Designed AI orchestration playbooks and adoption training for enterprise users.",
      outcomes: [
        "Delivered prompt design training across teams",
        "Improved workflow adoption with change management plans"
      ],
      stack: ["Python", "TypeScript"],
      evidence_urls: ["https://kinokoholic.com/projects/ai-enablement-program/"]
    }
  ],
  constraints: {
    location: "United States (remote/hybrid)",
    languages: ["English"],
    availability: "Open to full-time roles"
  }
};

describe("hard gates", () => {
  it("caps score at 60 when Japanese fluency is required but profile lacks it", () => {
    const jd = [
      "Responsibilities:",
      "- Build RAG workflows",
      "Requirements:",
      "- Python",
      "- Japanese fluency required (JLPT N1)"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "req-1");

    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.risk_flags.join(" ")).toContain("Score capped at 60");
  });

  it("caps score at 70 for onsite-required JD when profile is remote/hybrid", () => {
    const jd = [
      "Location: onsite only, 5 days in office",
      "Responsibilities:",
      "- Build workflows",
      "Requirements:",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "req-2");

    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.risk_flags.join(" ")).toContain("Score capped at 70");
  });
});

describe("confidence calculation", () => {
  it("returns Low for zero evidence matches", () => {
    const confidence = calculateConfidence([]);
    expect(confidence).toBe("Low");
  });

  it("returns Medium for 1-2 categories", () => {
    const confidence = calculateConfidence([
      { area: "Must-haves", evidence_title: "A", evidence_url: "u", rationale: "r" },
      { area: "Must-haves", evidence_title: "B", evidence_url: "u", rationale: "r" }
    ]);
    expect(confidence).toBe("Medium");
  });

  it("returns High for 3+ categories", () => {
    const confidence = calculateConfidence([
      { area: "Responsibilities", evidence_title: "A", evidence_url: "u", rationale: "r" },
      { area: "Must-haves", evidence_title: "B", evidence_url: "u", rationale: "r" },
      { area: "Domain fit", evidence_title: "C", evidence_url: "u", rationale: "r" }
    ]);
    expect(confidence).toBe("High");
  });
});

describe("skills fallback evidence", () => {
  it("maps unmatched skill terms to work-history evidence when available", () => {
    const profile: Profile = {
      skills: ["PMO reporting"],
      projects: [
        {
          name: "Work History",
          tags: ["enterprise delivery"],
          summary: "Career delivery history.",
          outcomes: ["Steering and governance across stakeholders"],
          stack: ["Program management"],
          evidence_urls: ["https://kinokoholic.com/work-history/"]
        }
      ],
      constraints: {
        location: "United States",
        languages: ["English"],
        availability: "Open to full-time roles"
      }
    };

    const jd = "Requirements:\n- PMO reporting and stakeholder updates";
    const result = analyzeJobDescription(jd, profile, "req-3");
    expect(result.strengths.some((item) => item.evidence_url === "https://kinokoholic.com/work-history/")).toBe(
      true
    );
  });
});

describe("input and rate-limit payload", () => {
  it("rejects jd_text over 15k chars", () => {
    const err = validateAnalyzeBody({ jd_text: "a".repeat(15001) });
    expect(err).toContain("exceeds max length");
  });

  it("respects custom jd_text max length overrides", () => {
    const err = validateAnalyzeBodyWithLimit({ jd_text: "a".repeat(101) }, 100);
    expect(err).toContain("exceeds max length of 100");
  });

  it("returns structured rate-limit payload with retry_after_seconds", () => {
    const payload = buildRateLimitErrorPayload("abc-123", 3600);
    expect(payload).toEqual({
      request_id: "abc-123",
      error: "Rate limit exceeded",
      retry_after_seconds: 3600
    });
  });
});
