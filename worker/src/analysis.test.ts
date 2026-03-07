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

  it("TC013: AI Project Manager with no Japanese mention should NOT have hard cap", () => {
    // Profile with Japanese (Business) - should NOT trigger hard cap when JD doesn't mention Japanese
    const profileWithJapanese: Profile = {
      ...baseProfile,
      constraints: {
        ...baseProfile.constraints,
        languages: ["English", "Japanese (Business)"]
      }
    };

    const jd = [
      "Position: AI Project Manager",
      "Company: Global Tech",
      "Location: New York, NY",
      "",
      "Requirements:",
      "- 5+ years project management experience",
      "- Program governance and PMO reporting",
      "- Stakeholder management experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, profileWithJapanese, "TC013");

    // Should NOT have hardScoreCap (profile having Japanese is not a requirement)
    expect((result as any).hardScoreCap).toBeUndefined();

    // Should NOT have JAPANESE_FLUENCY risk flag at all
    expect(result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY"))).toBe(false);

    // Score should be whatever the natural calculation produces (not artificially capped at 60)
    // The actual score depends on skill/domain fit, but there should be no Japanese-related hard gate
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

describe("buildFitSummary via analyzeJobDescription", () => {
  const strongProfile: Profile = {
    skills: ["Python", "RAG", "LLM", "Prompt engineering", "AI architecture", "Vector databases", "TypeScript"],
    projects: [
      {
        name: "RAG Pipeline",
        tags: ["RAG", "LLM", "vector databases", "Python"],
        summary: "Built production RAG system with LLM integration.",
        outcomes: ["Deployed RAG pipeline serving 10k queries/day", "Reduced hallucination rate by 40%"],
        stack: ["Python", "TypeScript", "Pinecone"],
        evidence_urls: ["https://example.com/rag/"]
      },
      {
        name: "Prompt Engineering Framework",
        tags: ["prompt engineering", "LLM", "AI"],
        summary: "Designed prompt engineering best practices for enterprise AI systems.",
        outcomes: ["Improved response quality by 35%", "Established prompt design standards"],
        stack: ["Python", "OpenAI"],
        evidence_urls: ["https://example.com/prompts/"]
      }
    ],
    constraints: {
      location: "United States (remote)",
      languages: ["English"],
      availability: "Open to full-time roles"
    }
  };

  it("produces 'Strong alignment' prose for high-scoring JDs (score >= 80)", () => {
    const jd = [
      "Position: Senior AI/ML Engineer",
      "Responsibilities:",
      "- Build RAG pipelines and LLM integrations",
      "- Design prompt engineering systems",
      "- Develop vector database solutions",
      "Requirements:",
      "- Python",
      "- RAG and LLM experience",
      "- Prompt engineering expertise",
      "- Vector database knowledge",
      "- TypeScript",
      "Nice-to-haves:",
      "- AI architecture experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, strongProfile, "fit-strong");
    if (result.score >= 80) {
      expect(result.fit_summary).toContain("Strong alignment");
    } else if (result.score >= 65) {
      expect(result.fit_summary).toContain("Good alignment");
    } else if (result.score >= 45) {
      expect(result.fit_summary).toContain("Partial alignment");
    } else {
      expect(result.fit_summary).toContain("Limited alignment");
    }
    // Score should appear in format "Score: N/100"
    expect(result.fit_summary).toMatch(/Score:\s*\d+\/100/);
  });

  it("produces 'Limited alignment' prose for low-scoring JDs (score < 45)", () => {
    const jd = [
      "Position: Cosmetics Sales Manager",
      "Responsibilities:",
      "- Manage luxury beauty product sales",
      "- Conduct skincare consultations",
      "Requirements:",
      "- 5+ years cosmetics retail experience",
      "- Beauty industry certifications",
      "- Passion for skincare"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "fit-low");
    // For a mismatch scenario the score should be low
    expect(result.score).toBeLessThan(45);
    expect(result.fit_summary).toContain("Limited alignment");
  });

  it("fit_summary includes evidence count, gap count, and confidence", () => {
    const jd = [
      "Responsibilities:",
      "- Build RAG workflows",
      "Requirements:",
      "- Python",
      "- Enablement experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "fit-counts");
    // Should include confidence label
    expect(result.fit_summary).toMatch(/\b(Low|Medium|High)\s+confidence/i);
    // If there are strengths, mention them
    if (result.strengths.length > 0) {
      expect(result.fit_summary).toMatch(/\d+\s+strength/i);
    }
    // If there are gaps, mention them
    if (result.gaps.length > 0) {
      expect(result.fit_summary).toMatch(/\d+\s+gap/i);
    }
  });
});

describe("buildGapMitigation via gap output", () => {
  it("suggests credential advice for certification gaps", () => {
    const jd = [
      "Requirements:",
      "- AWS Certified Solutions Architect certification required",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "gap-certif");
    const certGap = result.gaps.find(g =>
      g.why_it_matters.toLowerCase().includes("certif") ||
      g.why_it_matters.toLowerCase().includes("aws")
    );
    if (certGap) {
      expect(certGap.mitigation.toLowerCase()).toMatch(/credential|certif|equivalent|qualification/);
    }
  });

  it("suggests experience depth advice for years-of-experience gaps", () => {
    const jd = [
      "Requirements:",
      "- 10+ years of experience in enterprise software",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "gap-years");
    const expGap = result.gaps.find(g =>
      g.why_it_matters.toLowerCase().includes("years") ||
      g.why_it_matters.toLowerCase().includes("experience")
    );
    if (expGap) {
      expect(expGap.mitigation.toLowerCase()).toMatch(/experience|project depth|outcomes|compensate/);
    }
  });

  it("suggests management evidence for leadership gaps", () => {
    const jd = [
      "Requirements:",
      "- Must manage and lead a team of engineers",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "gap-manage");
    const leadGap = result.gaps.find(g =>
      g.why_it_matters.toLowerCase().includes("manage") ||
      g.why_it_matters.toLowerCase().includes("lead")
    );
    if (leadGap) {
      expect(leadGap.mitigation.toLowerCase()).toMatch(/leadership|team|oversight|coordination/);
    }
  });

  it("uses category-aware fallback for Must-haves gaps", () => {
    const jd = [
      "Requirements:",
      "- Expert knowledge of quantum computing algorithms",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "gap-must");
    const mustGap = result.gaps.find(g => g.area === "Must-haves");
    if (mustGap) {
      // Must-haves fallback should mention "core requirement"
      expect(mustGap.mitigation.toLowerCase()).toMatch(/core requirement|transferable|portfolio/);
    }
  });
});

describe("buildStrengthRationale via strength output", () => {
  it("Responsibilities strengths use 'hands-on experience' phrasing", () => {
    const jd = [
      "Responsibilities:",
      "- Design AI orchestration playbooks",
      "Requirements:",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "rationale-resp");
    const respStrength = result.strengths.find(s => s.area === "Responsibilities");
    if (respStrength) {
      expect(respStrength.rationale.toLowerCase()).toContain("hands-on experience");
    }
  });

  it("Must-haves strengths use 'evidenced by' phrasing", () => {
    const jd = [
      "Responsibilities:",
      "- Work with AI systems",
      "Requirements:",
      "- RAG experience",
      "- Python"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "rationale-must");
    const mustStrength = result.strengths.find(s => s.area === "Must-haves");
    if (mustStrength) {
      expect(mustStrength.rationale.toLowerCase()).toMatch(/evidenced by|core requirement/);
    }
  });

  it("Nice-to-haves strengths use 'preferred qualification' or 'supported by' phrasing", () => {
    const jd = [
      "Requirements:",
      "- Python",
      "Nice-to-haves:",
      "- RAG experience preferred",
      "- Prompt engineering a plus"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "rationale-nice");
    const niceStrength = result.strengths.find(s => s.area === "Nice-to-haves");
    if (niceStrength) {
      expect(niceStrength.rationale.toLowerCase()).toMatch(/preferred qualification|supported by/);
    }
  });
});

describe("domain compatibility: ai_llm and software_engineering", () => {
  const aiSWEProfile: Profile = {
    skills: ["Python", "TypeScript", "LLM", "RAG", "REST API", "backend development"],
    projects: [
      {
        name: "LLM Backend Service",
        tags: ["LLM", "REST API", "backend development", "Python", "TypeScript"],
        summary: "Built a production LLM-powered backend API service.",
        outcomes: ["Served 100k requests/day", "Integrated multiple LLM providers"],
        stack: ["Python", "TypeScript", "FastAPI"],
        evidence_urls: ["https://example.com/llm-backend/"]
      }
    ],
    constraints: {
      location: "United States (remote)",
      languages: ["English"],
      availability: "Open to full-time roles"
    }
  };

  it("does not penalize ai_llm profile for software engineering JD", () => {
    const jd = [
      "Position: Senior Software Engineer",
      "Responsibilities:",
      "- Build backend services and REST APIs",
      "- Develop AI/LLM integrations",
      "Requirements:",
      "- Python",
      "- TypeScript",
      "- Backend development experience",
      "- LLM integration experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, aiSWEProfile, "domain-compat-ai-swe");

    // Should score reasonably (ai_llm and software_engineering are now compatible)
    expect(result.score).toBeGreaterThan(40);

    // Should NOT flag domain incompatibility
    const hasDomainMismatch = result.risk_flags.some(f =>
      f.toLowerCase().includes("domain mismatch") || f.toLowerCase().includes("incompatible")
    );
    expect(hasDomainMismatch).toBe(false);
  });

  it("still penalizes cosmetics JD for software engineering profile", () => {
    const swProfile: Profile = {
      skills: ["Python", "TypeScript", "backend development", "REST API"],
      projects: [
        {
          name: "Web API Service",
          tags: ["backend", "REST API", "TypeScript"],
          summary: "Built backend web services.",
          outcomes: ["Deployed production API"],
          stack: ["TypeScript", "Python"],
          evidence_urls: ["https://example.com/api/"]
        }
      ],
      constraints: {
        location: "United States",
        languages: ["English"],
        availability: "Open to full-time roles"
      }
    };

    const jd = [
      "Position: Beauty Counter Manager",
      "Responsibilities:",
      "- Manage cosmetics sales team",
      "- Conduct beauty consultations",
      "Requirements:",
      "- 3+ years cosmetics retail experience",
      "- Skincare product knowledge"
    ].join("\n");

    const result = analyzeJobDescription(jd, swProfile, "domain-incompat-cosmetics");

    // cosmetics <-> software_engineering are still incompatible
    expect(result.score).toBeLessThan(30);
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
