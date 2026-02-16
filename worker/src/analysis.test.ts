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

  it("TC003: caps score at 60 for 'Native or fluent Japanese' pattern", () => {
    const jd = [
      "Position: Technical Project Manager",
      "Company: Tech Corporation",
      "Location: Tokyo",
      "",
      "Requirements:",
      "- 5+ years project management experience",
      "- Native or fluent Japanese language skills required",
      "- Experience with agile methodologies"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "tc-003");

    // Should trigger hard cap at 60
    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.risk_flags.some(f =>
      f.toLowerCase().includes("japanese") &&
      f.toLowerCase().includes("hard gate")
    )).toBe(true);
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

  it("TC004: caps score at 70 for 'fully onsite - no remote work' pattern", () => {
    const jd = [
      "Position: Senior Engineer",
      "Location: San Francisco",
      "",
      "Requirements:",
      "- 5+ years experience",
      "- Python development",
      "",
      "Work Arrangement:",
      "This is a fully onsite role - no remote work available"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "tc-004");

    // Should trigger hard cap at 70
    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.risk_flags.some(f =>
      f.toLowerCase().includes("onsite") &&
      f.toLowerCase().includes("hard gate")
    )).toBe(true);
  });

  it("detects various onsite patterns", () => {
    const onsitePatterns = [
      "5 days onsite required",
      "in-office 5 days per week",
      "onsite - no remote work available",
      "fully onsite role"
    ];

    for (const pattern of onsitePatterns) {
      const jd = `Requirements:\n- Python\n- ${pattern}`;
      const result = analyzeJobDescription(jd, baseProfile, `onsite-${pattern.length}`);

      // Each should trigger a hard cap at 70
      expect(result.score).toBeLessThanOrEqual(70);
      // Should have a risk flag mentioning onsite or hard gate
      const hasOnsiteRisk = result.risk_flags.some(f =>
        f.toLowerCase().includes("onsite") || f.toLowerCase().includes("hard gate")
      );
      expect(hasOnsiteRisk).toBe(true);
    }
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

describe("domain mismatch detection (TC002)", () => {
  it("TC002: prevents overscoring when JD is for cosmetics but profile is tech-only", () => {
    const techOnlyProfile: Profile = {
      skills: ["Python", "TypeScript", "Change management", "Stakeholder management"],
      projects: [
        {
          name: "Change Management Program",
          tags: ["change management", "enablement", "training"],
          summary: "Digital transformation program with focus on organizational change.",
          outcomes: [
            "Led relationship building across teams",
            "Delivered change management workshops"
          ],
          stack: ["Python", "TypeScript"],
          evidence_urls: ["https://example.com/change-management/"]
        }
      ],
      constraints: {
        location: "United States",
        languages: ["English"],
        availability: "Open to full-time roles"
      }
    };

    const jd = [
      "Position: Retail Cosmetics Sales Associate",
      "Company: Luxury Beauty Brand",
      "Location: New York",
      "",
      "Responsibilities:",
      "- Build relationships with customers in the cosmetics department",
      "- Provide beauty consultations and product recommendations",
      "- Drive sales in the beauty category",
      "- Maintain product knowledge of skincare and makeup lines",
      "",
      "Requirements:",
      "- 2+ years retail experience in cosmetics or beauty",
      "- Passion for beauty and skincare products"
    ].join("\n");

    const result = analyzeJobDescription(jd, techOnlyProfile, "tc-002");

    // Score should be low (expected 5-20), not high (73 like before the fix)
    expect(result.score).toBeLessThan(30);

    // Should have gaps for domain-specific requirements
    const hasCosmeticsGap = result.gaps.some(g =>
      g.why_it_matters.toLowerCase().includes("cosmetics") ||
      g.why_it_matters.toLowerCase().includes("beauty") ||
      g.why_it_matters.toLowerCase().includes("retail")
    );
    expect(hasCosmeticsGap).toBe(true);

    // Should NOT have strengths for "change management" since it doesn't match cosmetics domain
    const hasChangeMgmtStrength = result.strengths.some(s =>
      s.area.toLowerCase().includes("change") ||
      s.rationale.toLowerCase().includes("change management")
    );
    expect(hasChangeMgmtStrength).toBe(false);
  });

  it("correctly scores when profile has matching domain terms", () => {
    const cosmeticsProfile: Profile = {
      skills: ["Beauty consulting", "Retail sales", "Customer relationship building"],
      projects: [
        {
          name: "Cosmetics Sales Excellence",
          tags: ["cosmetics", "beauty", "retail"],
          summary: "Led beauty counter operations with focus on customer relationship building.",
          outcomes: [
            "Achieved sales targets in cosmetics category",
            "Built customer relationships through beauty consultations"
          ],
          stack: ["Salesforce", "POS"],
          evidence_urls: ["https://example.com/cosmetics-experience/"]
        }
      ],
      constraints: {
        location: "United States",
        languages: ["English"],
        availability: "Open to full-time roles"
      }
    };

    const jd = [
      "Position: Retail Cosmetics Sales Associate",
      "Company: Luxury Beauty Brand",
      "Location: New York",
      "",
      "Responsibilities:",
      "- Build relationships with customers in the cosmetics department",
      "- Provide beauty consultations and product recommendations",
      "",
      "Requirements:",
      "- 2+ years retail experience in cosmetics or beauty"
    ].join("\n");

    const result = analyzeJobDescription(jd, cosmeticsProfile, "tc-002-match");

    // Score should be higher since profile matches domain
    expect(result.score).toBeGreaterThan(50);

    // Should have strengths related to cosmetics/beauty
    const hasCosmeticsStrength = result.strengths.some(s =>
      s.rationale.toLowerCase().includes("cosmetics") ||
      s.rationale.toLowerCase().includes("beauty") ||
      s.evidence_title.toLowerCase().includes("cosmetics")
    );
    expect(hasCosmeticsStrength).toBe(true);
  });

  it("prevents generic skill matches from scoring when domains don't align", () => {
    const techProfile: Profile = {
      skills: ["Relationship building", "Communication", "Leadership"],
      projects: [
        {
          name: "Team Leadership Program",
          tags: ["leadership", "communication"],
          summary: "Program focused on relationship building in tech teams.",
          outcomes: ["Built strong relationships across engineering teams"],
          stack: ["Python", "TypeScript"],
          evidence_urls: ["https://example.com/leadership/"]
        }
      ],
      constraints: {
        location: "United States",
        languages: ["English"],
        availability: "Open to full-time roles"
      }
    };

    const jd = [
      "Position: Fashion Retail Manager",
      "Company: Luxury Apparel",
      "",
      "Requirements:",
      "- Relationship building with fashion clients",
      "- Experience in apparel industry",
      "- Customer communication skills"
    ].join("\n");

    const result = analyzeJobDescription(jd, techProfile, "tc-002-fashion");

    // Score should be low because tech leadership doesn't match fashion retail domain
    // Note: Generic skills like "communication" and "leadership" might match, so we allow up to 30
    expect(result.score).toBeLessThanOrEqual(30);

    // Should NOT match "relationship building" from tech profile to fashion JD if the line mentions "fashion"
    const hasRelationshipStrength = result.strengths.some(s =>
      s.rationale.toLowerCase().includes("relationship building")
    );
    expect(hasRelationshipStrength).toBe(false);
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
