/**
 * Unit tests for remaining E2E issues
 *
 * Issues to fix:
 * 1. TC011: Pure software engineering (Java, Go, SQL) scoring 71 instead of 20-40
 * 2. TC014: Minimal JD (83 chars) scoring 75 instead of 15-35
 * 3. TC010: Medium fit scoring 93 instead of 65-85
 */

import { describe, expect, it } from "vitest";
import { analyzeJobDescription } from './analysis';

const baseProfile = {
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
    },
    {
      name: "Application and Integration Delivery",
      tags: ["Integration", "API", "Automation"],
      summary: "Delivered integration solutions for education and depot systems.",
      outcomes: [
        "Built data pipelines for education platform",
        "Automated legacy system migration"
      ],
      stack: ["Python", "REST APIs", "SQL", "AWS"],
      evidence_urls: ["https://kinokoholic.com/work-history/"]
    },
    {
      name: "GenAI Enablement and Change Leadership",
      tags: ["Change management", "Enablement", "Stakeholder management"],
      summary: "Led AI enablement initiatives and organizational change.",
      outcomes: [
        "Delivered AI strategy workshops",
        "Facilitated cross-functional adoption"
      ],
      stack: ["Change management", "AI strategy"],
      evidence_urls: ["https://kinokoholic.com/work-history/"]
    }
  ],
  constraints: {
    location: "United States and Japan (open to remote and hybrid)",
    languages: ["English (Native)", "Japanese (Business)"],
    availability: "Open to full-time, consulting, or advisory AI/IT delivery roles"
  }
};

describe("TC011: Pure Software Engineering (No AI/LLM)", () => {
  it("should score low (20-40) for pure software engineering role", () => {
    const jd = [
      "Position: Senior Software Engineer",
      "Company: E-commerce Platform",
      "Location: San Francisco, CA",
      "",
      "Responsibilities:",
      "- Build and maintain web applications",
      "- Implement REST APIs and microservices",
      "- Optimize database queries and performance",
      "",
      "Requirements:",
      "- 5+ years Java or Go experience",
      "- Strong SQL and database skills",
      "- Experience with cloud platforms (AWS, GCP)",
      "",
      "Nice to have:",
      "- Kubernetes and Docker experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC011");

    console.log("TC011 Score:", result.score, "Expected: 20-40");
    console.log("TC011 Confidence:", result.confidence);
    console.log("TC011 Strengths:", result.strengths.map(s => ({ area: s.area, rationale: s.rationale })));

    // Score should be low due to domain mismatch (Java/Go/SQL vs Python/AI/LLM)
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.score).toBeGreaterThanOrEqual(20);

    // Confidence should be Low due to poor domain fit
    expect(result.confidence).toBe("Low");

    // Should have gaps for pure software skills (Java, Go, SQL)
    expect(result.gaps.some(g =>
      g.why_it_matters.toLowerCase().includes("java") ||
      g.why_it_matters.toLowerCase().includes("go") ||
      g.why_it_matters.toLowerCase().includes("sql")
    )).toBe(true);
  });
});

describe("TC014: Minimal JD", () => {
  it("should score low (15-35) for minimal 83-char JD", () => {
    const jd = "Looking for AI consultant with prompt engineering experience and RAG skills.";

    const result = analyzeJobDescription(jd, baseProfile, "TC014");

    console.log("TC014 Score:", result.score, "Expected: 15-35");
    console.log("TC014 Strengths:", result.strengths);

    // Score should be low due to minimal content
    expect(result.score).toBeLessThan(35);
    expect(result.score).toBeGreaterThanOrEqual(15);

    // Confidence should be Low due to limited information
    expect(result.confidence).toBe("Low");
  });
});

describe("TC010: Medium Fit - Tax/Finance Domain", () => {
  it("should not exceed 85 for medium fit role", () => {
    const jd = [
      "Position: AI Consultant",
      "Company: Financial Services",
      "Location: Remote (US)",
      "",
      "Responsibilities:",
      "- Provide AI strategy consulting",
      "- Design RAG systems for tax and finance workflows",
      "- Conduct prompt engineering workshops",
      "",
      "Requirements:",
      "- Experience with RAG and vector search",
      "- Python and LLM experience",
      "- Knowledge of tax and finance domain",
      "- Change management and enablement skills",
      "",
      "Nice to have:",
      "- Japanese language skills",
      "- Program governance experience"
    ].join("\n");

    const result = analyzeJobDescription(jd, baseProfile, "TC010");

    console.log("TC010 Score:", result.score, "Expected: 65-85");
    console.log("TC010 Rubric:", result.rubric_breakdown);
    console.log("TC010 Gaps:", result.gaps);

    // Score should be medium fit, not exceed 85
    expect(result.score).toBeLessThanOrEqual(85);
    expect(result.score).toBeGreaterThanOrEqual(65);

    // Confidence should be Medium (good fit but domain is niche)
    expect(result.confidence).toBe("Medium");
  });
});
