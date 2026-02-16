import { analyzeJobDescription } from './analysis';

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

console.log("=== TC001 DEBUG ===");
console.log("Score:", result.score);
console.log("Confidence:", result.confidence);
console.log("Risk Flags:", JSON.stringify(result.risk_flags, null, 2));
console.log("Has JAPANESE_FLUENCY prefix:", result.risk_flags.some(f => f.includes("JAPANESE_FLUENCY")));
console.log("==================");
