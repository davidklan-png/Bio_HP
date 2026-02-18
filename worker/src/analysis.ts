import { parseConfig, type ConfigEnv } from "./config";

console.log("[DEBUG] analysis.ts loaded, version 2.0");

export type Confidence = "Low" | "Medium" | "High";

type SectionName =
  | "responsibilities"
  | "requirements"
  | "nice_to_have"
  | "languages"
  | "general";

export interface AnalyzeRequestBody {
  jd_text: string;
}

export interface Strength {
  area: string;
  evidence_title: string;
  evidence_url: string;
  rationale: string;
}

export interface Gap {
  area: string;
  why_it_matters: string;
  mitigation: string;
}

export interface RubricItem {
  category: string;
  score: number;
  weight: number;
  notes: string;
}

export interface AnalyzeResponse {
  request_id: string;
  score: number;
  confidence: Confidence;
  fit_summary: string;
  strengths: Strength[];
  gaps: Gap[];
  risk_flags: string[];
  rubric_breakdown: RubricItem[];
  ai_metadata?: {
    ai_used: boolean;
    ai_model?: string;
    ai_interpreter_ok?: boolean;
    ai_writer_ok?: boolean;
  };
  debug?: {
    discarded_matches: number;
    parsed_jd?: {
      has_responsibilities: boolean;
      has_requirements: boolean;
      has_nice_to_haves: boolean;
      has_languages: boolean;
      languages_found: string[];
    };
  };
}

export interface ProfileProject {
  name: string;
  capability_tags?: string[];  // New: Semantic capability tags
  tags: string[];          // Legacy: Generic tags (still supported)
  summary: string;
  outcomes: string[];
  stack: string[];
  evidence?: Array<{ url: string; label?: string; snippet?: string }>;  // New: Structured evidence
  evidence_urls?: string[];  // Legacy: Simple URL array (deprecated but still supported)
}

export interface ProfileConstraints {
  location: string;
  languages: string[];
  availability: string;
}

export interface Profile {
  skills: string[];
  projects: ProfileProject[];
  constraints: ProfileConstraints;
}

interface ProjectIndex {
  project: ProfileProject;
  searchableTerms: string[];
}

type SkillEvidenceMap = Map<string, ProfileProject>;

interface SectionParseResult {
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  languages: string[];
  general: string[];
}

interface LineMatch {
  line: string;
  evidenceProject?: ProfileProject;
}

interface SectionEval {
  score: number;
  notes: string;
  matches: LineMatch[];
  misses: string[];
  discardedCount?: number;
}

interface RiskEvaluation extends SectionEval {
  riskFlags: string[];
  hardScoreCap?: number;
}

export interface RateLimitErrorPayload {
  request_id: string;
  error: "Rate limit exceeded";
  retry_after_seconds: number;
}

export const MAX_JD_CHARS = 15_000;
export const MAX_CONTENT_LENGTH = 30_000;

/** Standard risk flag types for machine-readable filtering */
export const STANDARD_RISK_FLAGS = {
  JAPANESE_FLUENCY: "JAPANESE_FLUENCY",
  ONSITE_REQUIRED: "ONSITE_REQUIRED",
  LANGUAGE_MISMATCH: "LANGUAGE_MISMATCH",
  CONTRACT_ONLY: "CONTRACT_ONLY",
  LOCATION_MISMATCH: "LOCATION_MISMATCH",
  CONTRACT_AVAILABILITY: "CONTRACT_AVAILABILITY",
  AVAILABILITY_MISMATCH: "AVAILABILITY_MISMATCH"
} as const;

export type RiskFlagType = keyof typeof STANDARD_RISK_FLAGS;

/** Helper function to get the value from the type */
export function getRiskFlagValue(type: RiskFlagType): string {
  return STANDARD_RISK_FLAGS[type];
}

/** Default thresholds - can be overridden via environment variables */
const JAPANESE_HARD_CAP = 60;
const ONSITE_HARD_CAP = 70;

/** Active configuration - set via environment */
let activeConfig = {
  japaneseHardCap: JAPANESE_HARD_CAP,
  onsiteHardCap: ONSITE_HARD_CAP,
};

/** Domain-specific terms for domain fit scoring (not generic tech skills) */
const DOMAIN_TERMS = [
  "cosmetics",
  "beauty",
  "skincare",
  "makeup",
  "fragrance",
  "consumer goods",
  "cpg",
  "retail",
  "ecommerce",
  "e-commerce",
  "fmcg",
  "fashion",
  "luxury",
  "personal care",
  "wellness",
  "apparel",
  "jewelry",
  "footwear"
];

/** Non-domain technical terms that should not count for domain fit */
const TECH_EXCLUDE_TERMS = new Set([
  "python",
  "javascript",
  "typescript",
  "java",
  "golang",
  "rust",
  "c++",
  "react",
  "vue",
  "angular",
  "node",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "sql",
  "nosql",
  "mongodb",
  "postgresql",
  "mysql",
  "redis",
  "graphql",
  "rest",
  "api",
  "llm",
  "llms",
  "prompt",
  "prompts",
  "prompting",
  "rag",
  "vector",
  "embedding",
  "embeddings",
  "transformer",
  "transformers",
  "model",
  "models",
  "training",
  "inference",
  "deployment",
  "integration",
  "integrations",
  "automation",
  "workflow",
  "workflows",
  "pipeline",
  "pipelines",
  "etl",
  "data",
  "analytics",
  "reporting",
  "governance",
  "management",
  "communication",
  "leadership",
  "delivery",
  "stakeholder",
  "cross",
  "functional",
  "focused",
  "adoption"
]);

/** Generic skills that should only match within compatible domains */
const GENERIC_SKILLS = [
  "communication",
  "communication skills",
  "leadership",
  "leadership experience",
  "management",
  "change management",
  "stakeholder",
  "stakeholder management",
  "relationship",
  "relationship building",
  "team",
  "team leadership",
  "cross-functional",
  "coordination",
  "reporting",
  // Generic technical skills that need domain validation
  "api",
  "rest",
  "microservices",
  "database",
  "sql",
  "cloud",
  "aws",
  "gcp",
  "docker",
  "kubernetes",
  "testing",
  "qa",
  "ci/cd",
  "integration",
  "delivery",
  "agile",
  "scrum",
  "devops"
];

/** Domain keyword mappings */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  // More specific domains first (checked in order)
  software_engineering: ["java", "golang", "c++", "rust", ".net", "spring", "nodejs", "backend development", "full stack", "fullstack", "software developer", "software engineer", "web application", "web development", "rest api", "microservices", "ci cd", "cicd", "sql", "database"],
  ai_llm: ["ai", "artificial intelligence", "llm", "large language model", "rag", "retrieval augmented", "prompt engineering", "prompt design", "vector database", "embedding", "agentic workflow", "machine learning", "ml", "deep learning", "nlp", "natural language processing", "generative ai"],
  // General domains
  cosmetics: ["cosmetics", "beauty", "skincare", "makeup", "fragrance", "salon"],
  fashion: ["fashion", "apparel", "retail", "clothing", "boutique", "style", "jewelry", "footwear"],
  finance: ["finance", "banking", "tax", "insurance", "investment"],
  enterprise: ["enterprise", "corporate", "governance", "program management", "PMO"],
  // Broader tech domain (checked last)
  tech: ["software", "tech", "IT", "digital", "cloud", "data"]
};

/**
 * Extract domain from text based on keywords
 */
function extractDomain(text: string): string | null {
  const normalized = normalizeText(text);

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (containsTerm(normalized, keyword)) {
        return domain;
      }
    }
  }
  return null;
}

/**
 * Check if two domains are compatible (same or related)
 */
function domainsCompatible(domain1: string | null, domain2: string | null): boolean {
  if (!domain1 || !domain2) {
    return true; // If either domain is unknown, allow match
  }

  // Exact match
  if (domain1 === domain2) {
    return true;
  }

  // Cross-domain compatibility mappings
  const compatiblePairs: Record<string, string[]> = {
    finance: ["enterprise", "tech", "ai_llm"],
    tech: ["enterprise", "finance", "ai_llm", "software_engineering"],
    enterprise: ["finance", "tech", "ai_llm"],
    ai_llm: ["tech", "enterprise", "finance"]
  };

  // Explicitly incompatible domain pairs
  const incompatiblePairs: Record<string, string[]> = {
    ai_llm: ["software_engineering"],
    software_engineering: ["ai_llm"]
  };

  // Check if domains are explicitly incompatible
  if (
    (domain1 && incompatiblePairs[domain1]?.includes(domain2)) ||
    (domain2 && incompatiblePairs[domain2]?.includes(domain1))
  ) {
    return false;
  }

  // Check if domains are compatible
  return !!(
    (domain1 && compatiblePairs[domain1]?.includes(domain2)) ||
    (domain2 && compatiblePairs[domain2]?.includes(domain1))
  );
}

/** Initialize configuration from environment variables */
export function initializeConfig(env: ConfigEnv): void {
  activeConfig = parseConfig(env);
}

/** Get current configuration values */
function getConfig() {
  return activeConfig;
}

const SYNONYM_GROUPS: string[][] = [
  ["change management", "adoption", "enablement", "training"],
  ["prompt engineering", "llm prompting", "prompt design"],
  ["agentic workflows", "agents", "ai orchestration"],
  ["digital transformation", "dx", "modernization"]
];

/** Concept clusters for semantic matching instead of token soup */
interface ConceptCluster {
  id: string;
  label: string;
  terms: string[];
  weight: number;
  sections: Array<"must_haves" | "responsibilities" | "nice_to_have">;
}

const CONCEPT_CLUSTERS: ConceptCluster[] = [
  {
    id: "prompt_engineering",
    label: "Prompt Engineering",
    terms: [
      "prompt engineering",
      "prompt design",
      "llm prompting",
      "prompt optimization",
      "prompt crafting",
      "prompt strategies"
    ],
    weight: 3,
    sections: ["must_haves", "responsibilities"]
  },
  {
    id: "agentic_workflows",
    label: "Agentic Workflows",
    terms: [
      "agentic workflows",
      "ai agents",
      "ai orchestration",
      "agent systems",
      "multi-agent",
      "autonomous agents",
      "agent architecture"
    ],
    weight: 3,
    sections: ["must_haves", "responsibilities"]
  },
  {
    id: "change_enablement",
    label: "Change Enablement",
    terms: [
      "change management",
      "adoption",
      "enablement",
      "change leadership",
      "organizational change",
      "transformation",
      "digital transformation"
    ],
    weight: 3,
    sections: ["must_haves", "responsibilities"]
  },
  {
    id: "workshops_training",
    label: "Workshops and Training",
    terms: [
      "workshops",
      "training",
      "coaching",
      "mentorship",
      "enablement",
      "knowledge sharing",
      "upskilling",
      "teaching non-technical",
      "de-mystifying ai"
    ],
    weight: 2,
    sections: ["must_haves", "responsibilities", "nice_to_have"]
  },
  {
    id: "python_integrations",
    label: "Python & Integrations",
    terms: [
      "python",
      "python integration",
      "api integration",
      "automation",
      "scripting",
      "backend development",
      "data pipelines"
    ],
    weight: 2,
    sections: ["must_haves", "responsibilities", "nice_to_have"]
  },
  {
    id: "llm_foundations",
    label: "LLM Foundations",
    terms: [
      "llm",
      "large language models",
      "rag",
      "retrieval augmented",
      "vector search",
      "embeddings",
      "llm application architecture",
      "generative ai"
    ],
    weight: 2,
    sections: ["must_haves", "responsibilities", "nice_to_have"]
  },
  {
    id: "stakeholder_management",
    label: "Stakeholder Management",
    terms: [
      "stakeholder management",
      "cross-functional",
      "vendor coordination",
      "client communication",
      "executive presence",
      "reporting"
    ],
    weight: 2,
    sections: ["must_haves", "responsibilities"]
  },
  {
    id: "governance_delivery",
    label: "Governance and Delivery",
    terms: [
      "governance",
      "delivery",
      "program management",
      "pmo",
      "steering",
      "risk management",
      "compliance"
    ],
    weight: 2,
    sections: ["must_haves", "responsibilities", "nice_to_have"]
  }
];

const RUBRIC_WEIGHTS = {
  responsibilities: 30,
  mustHaves: 30,
  niceToHaves: 10,
  domainFit: 10,
  deliveryCredibility: 15,
  riskConstraints: 5
} as const;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "your",
  "will",
  "you",
  "our",
  "are",
  "has",
  "into",
  "using",
  "about",
  "years",
  "year",
  "plus",
  "team",
  "role",
  "work",
  "experience"
]);

export function analyzeJobDescription(
  jdText: string,
  profile: Profile,
  requestId: string,
  aiContext?: {
    AI?: any;
    aiModelId?: string;
    aiEnabled?: boolean;
  }
): AnalyzeResponse {
  const projectIndex = buildProjectIndex(profile);
  const skillEvidence = buildSkillEvidenceMap(profile, projectIndex);
  const domainTerms = buildDomainTerms(profile);

  // AI metadata is always returned for observability, even when running deterministic-only scoring.
  const aiMetadata: AnalyzeResponse["ai_metadata"] = {
    ai_used: Boolean(aiContext?.AI && aiContext?.aiEnabled !== false),
    ai_interpreter_ok: false,
    ai_writer_ok: false,
    ...(aiContext?.aiModelId ? { ai_model: aiContext.aiModelId } : {})
  };

  // Grounding validation set - all valid evidence URLs from profile
  const validEvidenceUrls = new Set<string>();
  for (const project of profile.projects) {
    for (const url of getProjectEvidenceUrls(project)) {
      validEvidenceUrls.add(url);
    }
  }

  let totalDiscardedMatches = 0;

  const sections = splitIntoSections(jdText);
  const allLines = extractLines(jdText);

  // Extract domain terms from JD for validation
  const jdDomainTerms: string[] = [];
  const normalizedJd = normalizeText(jdText);
  for (const term of DOMAIN_TERMS) {
    if (containsTerm(normalizedJd, term)) {
      jdDomainTerms.push(term);
    }
  }

  const responsibilityLines = sections.responsibilities.length > 0 ? sections.responsibilities : allLines;
  const requirementLines =
    sections.requirements.length > 0 || sections.languages.length > 0
      ? [...sections.requirements, ...sections.languages]
      : allLines;

  const responsibilitiesEval = evaluateSection(
    responsibilityLines,
    RUBRIC_WEIGHTS.responsibilities,
    "Responsibilities",
    projectIndex,
    skillEvidence,
    jdDomainTerms,
    jdText
  );
  const mustHavesEval = evaluateSection(
    requirementLines,
    RUBRIC_WEIGHTS.mustHaves,
    "Must-haves",
    projectIndex,
    skillEvidence,
    jdDomainTerms,
    jdText
  );

  const niceEval =
    sections.nice_to_have.length > 0
      ? evaluateSection(
          sections.nice_to_have,
          RUBRIC_WEIGHTS.niceToHaves,
          "Nice-to-haves",
          projectIndex,
          skillEvidence,
          jdDomainTerms,
          jdText
        )
      : {
          score: Math.round(RUBRIC_WEIGHTS.niceToHaves * 0.5),
          notes: "No explicit nice-to-have section found; assigned neutral midpoint.",
          matches: [],
          misses: []
        };

  const domainEval = evaluateDomainFit(
    jdText,
    RUBRIC_WEIGHTS.domainFit,
    domainTerms,
    projectIndex,
    skillEvidence
  );
  const deliveryEval = evaluateDeliveryCredibility(
    [responsibilitiesEval, mustHavesEval, niceEval],
    RUBRIC_WEIGHTS.deliveryCredibility
  );
  const riskEval = evaluateRiskAndConstraints(jdText, profile.constraints, RUBRIC_WEIGHTS.riskConstraints);

  const rubricBreakdown: RubricItem[] = [
    {
      category: "Responsibilities match",
      score: responsibilitiesEval.score,
      weight: RUBRIC_WEIGHTS.responsibilities,
      notes: responsibilitiesEval.notes
    },
    {
      category: "Must-haves",
      score: mustHavesEval.score,
      weight: RUBRIC_WEIGHTS.mustHaves,
      notes: mustHavesEval.notes
    },
    {
      category: "Nice-to-haves",
      score: niceEval.score,
      weight: RUBRIC_WEIGHTS.niceToHaves,
      notes: niceEval.notes
    },
    {
      category: "Domain fit",
      score: domainEval.score,
      weight: RUBRIC_WEIGHTS.domainFit,
      notes: domainEval.notes
    },
    {
      category: "Delivery credibility",
      score: deliveryEval.score,
      weight: RUBRIC_WEIGHTS.deliveryCredibility,
      notes: deliveryEval.notes
    },
    {
      category: "Risk/constraints alignment",
      score: riskEval.score,
      weight: RUBRIC_WEIGHTS.riskConstraints,
      notes: riskEval.notes
    }
  ];

  const strengthsResult = collectStrengths(
    [
      ["Responsibilities", responsibilitiesEval],
      ["Must-haves", mustHavesEval],
      ["Nice-to-haves", niceEval],
      ["Domain fit", domainEval]
    ],
    validEvidenceUrls
  );
  totalDiscardedMatches += strengthsResult.discardedCount;
  const strengths = strengthsResult.strengths;

  const gaps = collectGaps([
    ["Responsibilities", responsibilitiesEval],
    ["Must-haves", mustHavesEval],
    ["Nice-to-haves", niceEval]
  ]);

  if (strengths.length === 0) {
    gaps.unshift({
      area: "Evidence coverage",
      why_it_matters:
        "No portfolio evidence links were matched to the JD text, so fit claims cannot be substantiated.",
      mitigation: "Add project evidence URLs in shared/profile.json or provide richer project outcomes/tags."
    });
  }

  const rawScore = clampScore(
    rubricBreakdown.reduce((sum, item) => sum + item.score, 0),
    0,
    100
  );

  console.log(`[DEBUG] rawScore calculation: jdText.length=${jdText.length}, rawScore=${rawScore}`);

  // Apply penalty for very short JDs (under 150 characters)
  // Very short JDs don't provide enough information for confident scoring
  let score = rawScore;
  if (jdText.length < 150) {
    // Reduce score proportionally to JD length
    // Minimum of 50 characters gets max 40% of rawScore
    // 150 characters gets 100% of rawScore
    const lengthRatio = (jdText.length - 50) / (150 - 50);
    const clampedRatio = Math.max(0.4, Math.min(1.0, lengthRatio));
    score = Math.round(rawScore * clampedRatio);
    console.log(`[DEBUG] Short JD penalty: length=${jdText.length}, rawScore=${rawScore}, ratio=${clampedRatio.toFixed(2)}, adjustedScore=${score}`);
  }

  // Cap medium-fit roles at 85
  // A role is "medium fit" if:
  // - Domain fit is good (>5) but not perfect (<10)
  // - There are meaningful gaps (not just minor details)
  // - Must-have coverage is high but not perfect
  const domainFitScore = rubricBreakdown.find(item => item.category === "Domain fit")?.score || 0;
  const mustHaveCoverage = mustHavesEval.matches.length > 0
    ? mustHavesEval.matches.filter(m => m.evidenceProject).length / mustHavesEval.matches.length
    : 0;

  // Check if this is a medium-fit scenario
  // Cap score for roles in niche domains (tax, finance, legal, etc.) that are not the primary tech focus
  const hasSignificantGaps = gaps.some(g => !g.area.includes("Evidence coverage"));

  // Extract domain from JD text
  const jdLower = jdText.toLowerCase();
  const hasNicheDomain = /tax|finance|legal|insurance|banking|accounting/.test(jdLower);

  // Cap at 85 for:
  // - Niche domain matches (tax, finance, etc.)
  // - Domain fit score is 10 (maxed out)
  // - Score would otherwise be perfect (100)
  // This prevents inflated scores for domain-specific matches that aren't the primary focus
  const shouldCapForNicheDomain = hasNicheDomain && domainFitScore === 10 && score > 85;

  console.log(`[DEBUG] Medium fit check: domainFit=${domainFitScore}, hasNicheDomain=${hasNicheDomain}, shouldCap=${shouldCapForNicheDomain}`);

  if (shouldCapForNicheDomain) {
    console.log(`[DEBUG] Niche domain cap applied: rawScore=${score}, domainFit=${domainFitScore} -> capped=85`);
    score = 85;
  }

  // Apply hard score cap if applicable
  if (typeof riskEval.hardScoreCap === "number") {
    score = Math.min(score, riskEval.hardScoreCap);
  }

  // Determine if parser succeeded (has parsed sections)
  const parserSuccess = sections.responsibilities.length > 0 ||
                      sections.requirements.length > 0 ||
                      sections.nice_to_have.length > 0 ||
                      sections.languages.length > 0;

  // Determine if there was a hard gate failure
  const hasHardGateFailure = typeof riskEval.hardScoreCap === "number" && riskEval.hardScoreCap < 80;

  const confidence = calculateConfidence({
    strengths,
    mustHavesEval,
    domainEval,
    hasHardGateFailure,
    parserSuccess,
    score
  });

  const fitSummary = buildFitSummary(score, confidence, strengths.length, gaps.length, riskEval.riskFlags);

  // Detect languages found in JD (for debug metadata)
  const languagesFound = detectLanguageRequirements(normalizeText(jdText));

  return {
    request_id: requestId,
    score,
    confidence,
    fit_summary: fitSummary,
    strengths,
    gaps,
    risk_flags: riskEval.riskFlags,
    rubric_breakdown: rubricBreakdown,
    ai_metadata: aiMetadata,
    debug: {
      discarded_matches: totalDiscardedMatches,
      parsed_jd: {
        has_responsibilities: sections.responsibilities.length > 0,
        has_requirements: sections.requirements.length > 0,
        has_nice_to_haves: sections.nice_to_have.length > 0,
        has_languages: sections.languages.length > 0,
        languages_found: languagesFound
      }
    }
  };
}

export interface ConfidenceInput {
  strengths: Strength[];
  mustHavesEval: SectionEval;
  domainEval: SectionEval;
  hasHardGateFailure: boolean;
  parserSuccess: boolean;
  score?: number;
}

export function calculateConfidence(input: ConfidenceInput | Strength[]): Confidence {
  // Handle legacy call signature (just strengths array)
  if (Array.isArray(input)) {
    const strongEvidenceByCategory = new Set(input.map((item) => item.area)).size;
    if (strongEvidenceByCategory >= 3) {
      return "High";
    }
    if (strongEvidenceByCategory >= 1) {
      return "Medium";
    }
    return "Low";
  }

  // New signature with full context
  const { strengths, mustHavesEval, domainEval, hasHardGateFailure, parserSuccess, score } = input;

  // If parser failed or hard gate failed, confidence is Low
  if (!parserSuccess || hasHardGateFailure) {
    return "Low";
  }

  // Low score (<= 40) indicates poor fit regardless of evidence count
  if (score !== undefined && score <= 40) {
    return "Low";
  }

  // Count unique evidence URLs (grounded evidence)
  const uniqueEvidenceUrls = new Set(strengths.map((s) => s.evidence_url)).size;

  // Count must-have coverage (how many must-haves have evidence)
  const mustHaveCoverage = mustHavesEval.matches.length > 0
    ? mustHavesEval.matches.filter((m) => m.evidenceProject).length / mustHavesEval.matches.length
    : 0;

  // Domain certainty: domain fit score indicates alignment
  const domainCertainty = domainEval.score >= 5; // At least 50% of domain fit weight

  // High confidence: good must-have coverage (70%+), multiple evidence URLs, domain aligned
  if (mustHaveCoverage >= 0.7 && uniqueEvidenceUrls >= 3 && domainCertainty) {
    return "High";
  }

  // Medium confidence: at least one evidence URL, parser succeeded
  if (uniqueEvidenceUrls >= 1) {
    return "Medium";
  }

  return "Low";
}

/**
 * Grounding guard: verifies that an evidence URL is from the profile (not JD text)
 * Returns true if the URL is valid profile evidence, false otherwise
 */
export function assertEvidenceIsFromProfile(evidenceUrl: string, validEvidenceUrls: Set<string>): boolean {
  return validEvidenceUrls.has(evidenceUrl);
}

/** Get all evidence URLs from a project, supporting both old and new schema */
function getProjectEvidenceUrls(project: ProfileProject): string[] {
  // New structured evidence format
  if (project.evidence && Array.isArray(project.evidence)) {
    return project.evidence.map((e) => e.url);
  }
  // Legacy format
  if (project.evidence_urls && Array.isArray(project.evidence_urls)) {
    return project.evidence_urls;
  }
  return [];
}

/** Get the best label/snippet from project evidence, if available */
function getEvidenceLabel(project: ProfileProject, evidenceUrl: string): { label?: string; snippet?: string } {
  // New structured evidence format
  if (project.evidence && Array.isArray(project.evidence)) {
    const evidenceItem = project.evidence.find((e) => e.url === evidenceUrl);
    if (evidenceItem && typeof evidenceItem === "object" && evidenceItem !== null) {
      const evidenceLabel: { label?: string; snippet?: string } = {};
      if (evidenceItem.label) {
        evidenceLabel.label = evidenceItem.label;
      }
      if (evidenceItem.snippet) {
        evidenceLabel.snippet = evidenceItem.snippet;
      }
      return evidenceLabel;
    }
  }
  return {};
}

export function validateAnalyzeBody(body: unknown): string | null {
  return validateAnalyzeBodyWithLimit(body, MAX_JD_CHARS);
}

export function validateAnalyzeBodyWithLimit(body: unknown, maxJdChars: number): string | null {
  if (!body || typeof body !== "object") {
    return "JSON body must be an object";
  }

  const candidate = body as Partial<AnalyzeRequestBody>;
  if (typeof candidate.jd_text !== "string") {
    return "Field jd_text must be a string";
  }

  if (candidate.jd_text.trim().length === 0) {
    return "Field jd_text cannot be empty";
  }

  if (candidate.jd_text.length > maxJdChars) {
    return `Field jd_text exceeds max length of ${maxJdChars} characters`;
  }

  return null;
}

export function buildRateLimitErrorPayload(
  requestId: string,
  retryAfterSeconds: number
): RateLimitErrorPayload {
  return {
    request_id: requestId,
    error: "Rate limit exceeded",
    retry_after_seconds: Math.max(1, Math.floor(retryAfterSeconds))
  };
}

export function parseAndValidateProfile(input: unknown): Profile {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid profile data: expected object");
  }

  const profile = input as Partial<Profile>;

  if (!Array.isArray(profile.skills)) {
    throw new Error("Invalid profile data: skills must be an array");
  }
  if (!Array.isArray(profile.projects)) {
    throw new Error("Invalid profile data: projects must be an array");
  }
  if (!profile.constraints || typeof profile.constraints !== "object") {
    throw new Error("Invalid profile data: constraints must be an object");
  }

  for (const project of profile.projects) {
    if (!project || typeof project !== "object") {
      throw new Error("Invalid profile data: project must be an object");
    }

    const typed = project as Partial<ProfileProject>;
    if (typeof typed.name !== "string") {
      throw new Error("Invalid profile data: project.name must be a string");
    }
    if (!Array.isArray(typed.tags) || !Array.isArray(typed.outcomes) || !Array.isArray(typed.stack)) {
      throw new Error("Invalid profile data: project tags/outcomes/stack must be arrays");
    }
    // Support both legacy evidence_urls and new evidence format
    const hasEvidenceUrls = Array.isArray(typed.evidence_urls);
    const hasEvidence = Array.isArray(typed.evidence);
    if (!hasEvidenceUrls && !hasEvidence) {
      throw new Error("Invalid profile data: project must have evidence_urls or evidence array");
    }
  }

  return profile as Profile;
}

/**
 * Detects if the JD contains domain terms that are NOT in the profile's domain terms
 * This indicates a domain mismatch (e.g., JD is for cosmetics but profile is tech-only)
 */
function detectDomainMismatch(jdText: string, profileDomainTerms: string[]): boolean {
  const normalizedJd = normalizeText(jdText);

  // Check for common non-tech domains that might indicate mismatch
  const mismatchDomains = ["cosmetics", "beauty", "skincare", "makeup", "fragrance", "fashion", "apparel", "jewelry", "footwear"];

  for (const domain of mismatchDomains) {
    if (containsTerm(normalizedJd, domain)) {
      // If JD mentions this domain but profile doesn't have it, it's a mismatch
      const profileHasDomain = profileDomainTerms.some(term => containsTerm(term, domain));
      if (!profileHasDomain) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a project matches the JD's domain context
 * Returns false if the project is clearly from a different domain than the JD
 */
function projectMatchesDomain(project: ProfileProject, jdDomainTerms: string[]): boolean {
  // If JD has no clear domain terms, any project is acceptable
  if (jdDomainTerms.length === 0) {
    return true;
  }

  const projectText = normalizeText(
    `${project.name} ${project.summary} ${project.tags.join(" ")} ${project.outcomes.join(" ")}`
  );

  // Check if project has any matching domain terms
  for (const domainTerm of jdDomainTerms) {
    if (containsTerm(projectText, domainTerm)) {
      return true;
    }
  }

  // If project has no domain overlap with JD, it's a mismatch
  return false;
}

function evaluateSection(
  lines: string[],
  weight: number,
  label: string,
  projectIndex: ProjectIndex[],
  skillEvidence: SkillEvidenceMap,
  jdDomainTerms: string[] = [],
  jdText: string = ""
): SectionEval {
  const sanitizedLines = lines.map((line) => line.trim()).filter(Boolean).slice(0, 24);
  if (sanitizedLines.length === 0) {
    return {
      score: 0,
      notes: `${label} section not found.`,
      matches: [],
      misses: []
    };
  }

  const matches: LineMatch[] = [];
  const misses: string[] = [];

  // Extract JD's domain from JD text using DOMAIN_KEYWORDS
  let jdDomain: string | null = null;
  const detectedJDDomainTerms: string[] = [];
  const normalizedJdText = normalizeText(jdText);
  
  console.log(`[DEBUG] evaluateSection: label=${label}, jdText.length=${jdText.length}, normalizedJdText.length=${normalizedJdText.length}`);
  console.log(`[DEBUG] evaluateSection: normalizedJdText="${normalizedJdText.substring(0, 200)}..."`);

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    console.log(`[DEBUG] Checking domain ${domain} with ${keywords.length} keywords`);
    for (const keyword of keywords) {
      if (containsTerm(normalizedJdText, keyword)) {
        console.log(`[DEBUG] Found keyword "${keyword}" for domain ${domain}`);
        if (!detectedJDDomainTerms.includes(domain)) {
          detectedJDDomainTerms.push(domain);
        }
        jdDomain = domain;
        break;
      }
    }
    if (jdDomain) break;
  }

  console.log(`[DEBUG] evaluateSection: jdDomain=${jdDomain}, detectedDomains=[${detectedJDDomainTerms.join(', ')}]`);

  // Check if there's any domain overlap between JD and profile
  let hasDomainOverlap = jdDomain === null; // No domain detected = allow all
  let domainCompatibilityRatio = 1.0; // Default: fully compatible

  if (jdDomain !== null) {
    hasDomainOverlap = false;
    let compatibleProjects = 0;
    let totalProjects = 0;

    // Check if any profile project matches JD's domain
    for (const entry of projectIndex) {
      const projectDomain = extractDomain(
        `${entry.project.name} ${entry.project.summary} ${entry.project.tags.join(" ")}`
      );
      totalProjects++;
      const isCompatible = domainsCompatible(jdDomain, projectDomain);
      console.log(`[DEBUG] Project domain check: project="${entry.project.name.substring(0, 30)}", projectDomain=${projectDomain}, compatible=${isCompatible}`);
      if (isCompatible) {
        compatibleProjects++;
      }
    }

    // Calculate compatibility ratio
    domainCompatibilityRatio = totalProjects > 0 ? compatibleProjects / totalProjects : 0;

    // Require at least 25% of projects to be compatible for domain overlap
    // This prevents a single outlier project from creating false compatibility
    hasDomainOverlap = domainCompatibilityRatio >= 0.25;

    console.log(`[DEBUG] Domain compatibility: ${compatibleProjects}/${totalProjects} projects compatible (${(domainCompatibilityRatio * 100).toFixed(0)}%), hasDomainOverlap=${hasDomainOverlap}`);
  }

  for (const line of sanitizedLines) {
    const evidenceProject = findBestEvidenceProject(line, projectIndex, skillEvidence);

    if (evidenceProject) {
      const normalizedLine = normalizeText(line);

      // Check if the matched line contains a generic skill
      const isGenericSkill = GENERIC_SKILLS.some(skill =>
        normalizedLine.includes(skill)
      );

      // For generic skills, validate domain compatibility at the project level
      if (isGenericSkill && jdDomain) {
        const projectDomain = extractDomain(
          `${evidenceProject.name} ${evidenceProject.summary} ${evidenceProject.tags.join(" ")}`
        );

        if (!domainsCompatible(jdDomain, projectDomain)) {
          // Generic skill in incompatible domain - don't count as evidence
          console.log(`[DEBUG] Domain mismatch for generic skill: JD domain=${jdDomain}, project domain=${projectDomain}. Rejecting match for line: "${line.substring(0, 50)}..."`);
          matches.push({ line });
          misses.push(line);
          continue;
        }
      }

      // For domain-specific matches, validate domain compatibility
      const isDomainSpecificMatch = jdDomainTerms.some(domainTerm => containsTerm(normalizedLine, domainTerm));
      if (isDomainSpecificMatch && jdDomainTerms.length > 0) {
        const domainMatch = projectMatchesDomain(evidenceProject, jdDomainTerms);
        if (!domainMatch) {
          // Project doesn't match JD's domain - don't count as evidence
          matches.push({ line });
          misses.push(line);
          continue;
        }
      }

      matches.push({ line, evidenceProject });
    } else {
      matches.push({ line });
      misses.push(line);
    }
  }

  const linesWithEvidence = matches.filter((m) => m.evidenceProject).length;
  const coverage = linesWithEvidence / sanitizedLines.length;
  let score = clampScore(Math.round(weight * coverage), 0, weight);

  // Apply domain compatibility penalty if applicable
  if (domainCompatibilityRatio < 1.0 && domainCompatibilityRatio > 0) {
    const penalty = 1.0 - domainCompatibilityRatio;
    score = Math.round(score * (1.0 - penalty * 0.5)); // Apply up to 50% of the penalty
    console.log(`[DEBUG] Applied domain compatibility penalty: ratio=${(domainCompatibilityRatio * 100).toFixed(0)}%, originalScore=${Math.round(weight * coverage)}, adjustedScore=${score}`);
  }

  const notes = `${linesWithEvidence}/${sanitizedLines.length} ${label.toLowerCase()} items have direct portfolio evidence.`;

  return { score, notes, matches, misses };
}

function evaluateDomainFit(
  jdText: string,
  weight: number,
  domainTerms: string[],
  projectIndex: ProjectIndex[],
  skillEvidence: SkillEvidenceMap
): SectionEval {
  const normalizedJd = normalizeText(jdText);
  const matchedTerms: string[] = [];
  const matches: LineMatch[] = [];

  for (const term of domainTerms) {
    if (!containsTerm(normalizedJd, term)) {
      continue;
    }

    const project = findBestEvidenceProject(term, projectIndex, skillEvidence);
    if (project) {
      matchedTerms.push(term);
      matches.push({ line: `Domain signal: ${term}`, evidenceProject: project });
    }
  }

  const uniqueTerms = Array.from(new Set(matchedTerms));
  const score = clampScore(Math.min(weight, uniqueTerms.length * 3 + (uniqueTerms.length > 0 ? 1 : 0)), 0, weight);

  const notes =
    uniqueTerms.length > 0
      ? `Matched domain terms with evidence: ${uniqueTerms.join(", ")}.`
      : "No domain-specific overlap found in profile evidence.";

  return {
    score,
    notes,
    matches,
    misses: uniqueTerms.length === 0 ? ["No evidence found for JD domain alignment."] : []
  };
}

function evaluateDeliveryCredibility(sectionEvals: SectionEval[], weight: number): SectionEval {
  const projects = new Set<string>();
  for (const evalResult of sectionEvals) {
    for (const match of evalResult.matches) {
      if (match.evidenceProject?.name) {
        projects.add(match.evidenceProject.name);
      }
    }
  }

  const projectCount = projects.size;
  const score = clampScore(Math.min(weight, projectCount * 5), 0, weight);
  const notes =
    projectCount > 0
      ? `Evidence spans ${projectCount} project(s), indicating delivery track record.`
      : "No evidence-linked project matches; delivery credibility is unproven for this JD.";

  return {
    score,
    notes,
    matches: [],
    misses: projectCount > 0 ? [] : ["No evidence found for delivery credibility."]
  };
}

function evaluateRiskAndConstraints(
  jdText: string,
  constraints: ProfileConstraints,
  weight: number
): RiskEvaluation {
  const normalizedJd = normalizeText(jdText);
  const normalizedLocation = normalizeText(constraints.location);
  const riskFlags: string[] = [];
  let score = weight;
  let hardScoreCap: number | undefined;

  const addRiskFlag = (flag: RiskFlagType, message: string): void => {
    const formattedFlag = `${flag}: ${message}`;
    if (!riskFlags.includes(formattedFlag)) {
      riskFlags.push(formattedFlag);
    }
  };
  const triggerHardGate = (flag: RiskFlagType, message: string, cap: number): void => {
    addRiskFlag(flag, message);
    hardScoreCap = typeof hardScoreCap === "number" ? Math.min(hardScoreCap, cap) : cap;
  };

  const jdRequiresOnsite =
    /(onsite only|on site only|must be located|relocat(e|ion) required|in office five days|5 days onsite|5 days on site|in-office|fully onsite|onsite - no remote)/i.test(
      jdText
    );
  const profilePrefersRemote = /remote|hybrid/.test(normalizedLocation);

  if (jdRequiresOnsite && profilePrefersRemote) {
    const config = getConfig();
    triggerHardGate(
      "ONSITE_REQUIRED",
      `Hard gate: JD appears onsite-required but profile location preference suggests remote/hybrid. Score capped at ${config.onsiteHardCap}.`,
      config.onsiteHardCap
    );
    score -= 2;
  }

  const requiredLanguages = detectLanguageRequirements(normalizedJd);
  // Check if profile satisfies each required language using word boundary matching
  for (const language of requiredLanguages) {
    const profileHasLanguage = constraints.languages.some((langEntry) => {
      const normalizedEntry = normalizeText(langEntry);
      // Use word boundary matching to check if the language is mentioned
      const pattern = new RegExp(`\\b${escapeRegex(language)}\\b`, "i");
      return pattern.test(normalizedEntry);
    });

    if (!profileHasLanguage) {
      addRiskFlag("LANGUAGE_MISMATCH", `No evidence found for required language: ${language}.`);
      score -= 2;
    }
  }

  // Check for fluent/native Japanese requirements (hard gate at 60)
  const jdRequiresJapaneseFluent =
    /((native or fluent|fluent or native|fluent|fluency|native|professional|advanced).{0,24}japanese|japanese.{0,24}(native or fluent|fluent or native|fluent|fluency|native|professional|advanced)|jlpt\s*n1|japanese\s*n1)/i.test(
      jdText
    );
  const profileHasJapaneseFluent = constraints.languages.some((entry) => {
    const normalized = normalizeText(entry);
    const mentionsJapanese = /\bjapanese\b/.test(normalized);
    const fluentSignal = /\b(fluent|fluency|native|professional|advanced|n1)\b/.test(normalized);
    return mentionsJapanese && fluentSignal;
  });

  // Check for any Japanese requirement (including business level - adds risk flag, no hard cap)
  const jdRequiresJapanese = /japanese/i.test(jdText);
  const profileHasJapanese = constraints.languages.some((entry) => /\bjapanese\b/i.test(entry));

  // Hard cap for fluent/native Japanese requirement
  if (jdRequiresJapaneseFluent && !profileHasJapaneseFluent) {
    const config = getConfig();
    triggerHardGate(
      "JAPANESE_FLUENCY",
      `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${config.japaneseHardCap}.`,
      config.japaneseHardCap
    );
    score -= 2;
  }

  // Risk flag for any Japanese requirement (including business level)
  if (jdRequiresJapanese && !profileHasJapanese) {
    addRiskFlag("JAPANESE_FLUENCY", "No evidence found for required language: Japanese.");
    score -= 2;
  }

  // Detect capacity/availability/contract requirements and treat as constraints, not gaps
  const jdWorkTypePattern = /^Capacity:\s*(part-time|full-time|contract)(\s*%?\s*allocation)?\s*$/i;
  const jdRequiresAvailability = /Availability:\s*(remote|hybrid|part-time|full-time|contract)/i.test(jdText);
  const profileAvailability = constraints.availability.toLowerCase();
  const jdRequiresPartTime = /part-?time/i.test(jdText);
  const contractOnly = /(contract only|short term contract|no full time)/i.test(jdText);

  if (jdRequiresPartTime) {
    const jdMatch = jdText.match(jdWorkTypePattern);
    const jdWorkType = jdMatch?.[1] ?? "";

    const isAvailabilityMismatch = jdWorkType !== "" && !profileAvailability.includes(jdWorkType);

    if (isAvailabilityMismatch) {
      const constraintType: RiskFlagType = jdWorkType === "contract"
        ? "CONTRACT_AVAILABILITY"
        : "AVAILABILITY_MISMATCH";

      addRiskFlag(
        constraintType,
        `JD requires ${jdWorkType} availability ` +
        `but profile availability is "${profileAvailability}".` +
        (jdWorkType === "part-time" ? " Not aligned with role type." : "")
      );
    }
  }

  if (contractOnly && constraints.availability.toLowerCase().includes("full-time")) {
    addRiskFlag("CONTRACT_ONLY", "Availability may not align (JD appears contract-only).");
    score -= 1;
  }

  score = clampScore(score, 0, weight);

  return {
    score,
    notes:
      riskFlags.length > 0
        ? `Risk flags identified: ${riskFlags.length}.`
        : "No explicit constraint conflicts detected.",
    matches: [],
    misses: [],
    riskFlags,
    ...(typeof hardScoreCap === "number" ? { hardScoreCap } : {})
  };
}

function collectStrengths(
  entries: Array<[string, SectionEval]>,
  validEvidenceUrls: Set<string>
): { strengths: Strength[]; discardedCount: number } {
  const strengths: Strength[] = [];
  const seen = new Set<string>();
  let discardedCount = 0;

  for (const [area, evalResult] of entries) {
    const evidenced = evalResult.matches.filter((match) =>
      match.evidenceProject ? getProjectEvidenceUrls(match.evidenceProject).length > 0 : false
    );
    if (evidenced.length === 0) {
      continue;
    }

    const best = evidenced[0];
    if (!best) {
      continue;
    }
    const project = best.evidenceProject;
    if (!project) {
      continue;
    }

    const evidenceUrls = getProjectEvidenceUrls(project);
    const evidenceUrl = evidenceUrls[0];
    if (!evidenceUrl) {
      continue;
    }

    // Grounding guard: ensure evidence URL is from profile
    if (!assertEvidenceIsFromProfile(evidenceUrl, validEvidenceUrls)) {
      discardedCount++;
      continue;
    }

    const key = `${area}:${project.name}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    // Map to cluster-based label for better semantics
    const clusterLabel = findClusterLabel(best.line, area);

    // Build a cleaner rationale that mentions the requirement and project
    const requirementPhrase = extractRequirementPhrase(best.line);
    const rationale = buildStrengthRationale(requirementPhrase, project.name, area);

    strengths.push({
      area: clusterLabel || area,
      evidence_title: project.name,
      evidence_url: evidenceUrl,
      rationale
    });
  }

  return { strengths: strengths.slice(0, 8), discardedCount };
}

/** Extract a short, meaningful phrase from the JD line for the rationale */
function extractRequirementPhrase(jdLine: string): string {
  // Remove common bullet prefixes and trim
  let phrase = jdLine
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();

  // If still long, truncate at first sentence or comma
  if (phrase.length > 60) {
    const firstSentence = phrase.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 60) {
      return firstSentence.trim();
    }
    // Otherwise truncate at word boundary
    return truncate(phrase, 50) + "...";
  }

  return phrase;
}

/** Build a clean, human-readable rationale */
function buildStrengthRationale(requirement: string, projectName: string, category: string): string {
  // Remove trailing period if present
  const cleanReq = requirement.replace(/\.$/, "").trim();
  const categoryStr = category === "Domain fit" ? "domain alignment" : category.toLowerCase();
  return `Matched "${cleanReq}" to ${projectName} (${categoryStr}).`;
}

/** Find a semantic cluster label based on the matched JD text */
function findClusterLabel(jdLine: string, sectionArea: string): string | null {
  const normalizedLine = normalizeText(jdLine);

  for (const cluster of CONCEPT_CLUSTERS) {
    // Check if any cluster term matches the JD line
    for (const term of cluster.terms) {
      const normalizedTerm = normalizeText(term);
      if (normalizedLine.includes(normalizedTerm)) {
        return cluster.label;
      }
    }
  }

  // If no cluster match, return null (caller will use section area)
  return null;
}

/** Lines that look like headings and should not create gaps */
const HEADING_PATTERNS = [
  /^languages?\s*:?$/i,
  /^capacity\s*:?$/i,
  /^location\s*:?$/i,
  /^availability\s*:?$/i,
  /^requirements?\s*:?$/i,
  /^responsibilities?\s*:?$/i,
  /^nice-?\s*to-?\s*have\s*:?$/i,
  /^(project )?summary\s*:?$/i
];

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  // Empty lines are not headings
  if (!trimmed) {
    return false;
  }
  // Check against heading patterns
  for (const pattern of HEADING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  // Very short lines (under 15 chars) ending with colon are likely headings
  if (trimmed.length < 15 && trimmed.endsWith(":")) {
    return true;
  }
  return false;
}

function collectGaps(entries: Array<[string, SectionEval]>): Gap[] {
  const gaps: Gap[] = [];

  for (const [area, evalResult] of entries) {
    if (evalResult.misses.length === 0) {
      continue;
    }

    // Filter out heading lines from gaps
    const meaningfulMisses = evalResult.misses.filter((line) => !isHeadingLine(line));

    for (const missedLine of meaningfulMisses.slice(0, 2)) {
      gaps.push({
        area,
        why_it_matters: `No evidence found for: "${truncate(missedLine, 120)}".`,
        mitigation:
          "Add a project with measurable outcomes and an evidence URL, or document related evidence in shared/profile.json."
      });
    }
  }

  return gaps.slice(0, 8);
}

function buildFitSummary(
  score: number,
  confidence: Confidence,
  strengthCount: number,
  gapCount: number,
  riskFlags: string[]
): string {
  const riskSnippet =
    riskFlags.length > 0
      ? `${riskFlags.length} risk flag(s) need review before application.`
      : "No major constraints risk was detected from JD text.";

  return `Compatibility score ${score}/100 (${confidence} confidence). Evidence-backed strengths: ${strengthCount}. Gaps or unknowns: ${gapCount}. ${riskSnippet}`;
}

function findBestEvidenceProject(
  input: string,
  projectIndex: ProjectIndex[],
  skillEvidence: SkillEvidenceMap
): ProfileProject | undefined {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) {
    return undefined;
  }

  let bestProject: ProfileProject | undefined;
  let bestScore = 0;

  for (const index of projectIndex) {
    const project = index.project;
    const evidenceUrls = getProjectEvidenceUrls(project);
    if (evidenceUrls.length === 0) {
      continue;
    }

    let matchScore = 0;
    for (const term of index.searchableTerms) {
      if (containsTerm(normalizedInput, term)) {
        matchScore += term.includes(" ") ? 2 : 1;
      }
    }

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestProject = project;
    }
  }

  if (bestScore > 0 && bestProject) {
    return bestProject;
  }

  for (const [skillTerm, project] of skillEvidence.entries()) {
    if (containsTerm(normalizedInput, skillTerm)) {
      return project;
    }
  }

  return undefined;
}

function splitIntoSections(jdText: string): SectionParseResult {
  const result: SectionParseResult = {
    responsibilities: [],
    requirements: [],
    nice_to_have: [],
    languages: [],
    general: []
  };

  const lines = jdText.split(/\r?\n/);
  let currentSection: SectionName = "general";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const section = detectSectionHeading(trimmed);
    if (section) {
      currentSection = section;
      continue;
    }

    const cleaned = cleanedLine(trimmed);
    if (!cleaned) {
      continue;
    }

    result[currentSection].push(cleaned);
  }

  return result;
}

function detectSectionHeading(line: string): SectionName | undefined {
  const lower = line.toLowerCase().replace(/[:\-]+$/, "").trim();
  if (lower.length > 80) {
    return undefined;
  }

  if (/responsibilit|what you('|’)ll do|duties|scope/.test(lower)) {
    return "responsibilities";
  }
  if (/requirements|must[- ]?have|required|qualifications|you have/.test(lower)) {
    return "requirements";
  }
  if (/nice to have|preferred|bonus|good to have|plus/.test(lower)) {
    return "nice_to_have";
  }
  if (/languages|tech stack|tooling|tools/.test(lower)) {
    return "languages";
  }
  return undefined;
}

function cleanedLine(line: string): string {
  return line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanedLine(line.trim()))
    .filter((line) => line.length > 0)
    .slice(0, 28);
}

function detectLanguageRequirements(normalizedJd: string): string[] {
  const supportedCandidates = [
    "english",
    "japanese",
    "spanish",
    "french",
    "german",
    "mandarin",
    "cantonese",
    "korean"
  ];

  const detected: string[] = [];
  for (const candidate of supportedCandidates) {
    if (containsTerm(normalizedJd, candidate)) {
      detected.push(candidate);
    }
  }
  return detected;
}

function buildProjectIndex(profile: Profile): ProjectIndex[] {
  return profile.projects.map((project) => {
    const rawTerms = [
      project.name,
      project.summary,
      ...project.tags,
      ...project.stack,
      ...project.outcomes
    ];

    // Add capability_tags for semantic matching
    if (project.capability_tags && Array.isArray(project.capability_tags)) {
      rawTerms.push(...project.capability_tags);
    }

    const termSet = new Set<string>();

    for (const raw of rawTerms) {
      const normalized = normalizeText(raw);
      if (normalized.length >= 3) {
        termSet.add(normalized);
      }

      for (const token of tokenize(raw)) {
        if (token.length >= 4) {
          termSet.add(token);
        }
      }
    }

    return {
      project,
      searchableTerms: Array.from(termSet)
    };
  });
}

function buildDomainTerms(profile: Profile): string[] {
  const domainSet = new Set<string>();

  // Extract domain-relevant terms from profile projects (but exclude generic tech terms)
  for (const project of profile.projects) {
    for (const tag of project.tags) {
      const normalized = normalizeText(tag);
      // Only add if not in tech exclude list and length >= 4
      if (!TECH_EXCLUDE_TERMS.has(normalized) && normalized.length >= 4) {
        domainSet.add(normalized);
      }
    }

    // Also check summary for domain-specific terms (only add if explicitly mentioned)
    const normalizedSummary = normalizeText(project.summary);
    for (const term of DOMAIN_TERMS) {
      if (normalizedSummary.includes(term.toLowerCase())) {
        domainSet.add(term.toLowerCase());
      }
    }

    // Check outcomes as well
    for (const outcome of project.outcomes) {
      const normalized = normalizeText(outcome);
      for (const term of DOMAIN_TERMS) {
        if (normalized.includes(term.toLowerCase())) {
          domainSet.add(term.toLowerCase());
        }
      }
    }
  }

  return Array.from(domainSet);
}

function buildSkillEvidenceMap(profile: Profile, projectIndex: ProjectIndex[]): SkillEvidenceMap {
  const map: SkillEvidenceMap = new Map();
  const fallbackProject = findFallbackEvidenceProject(projectIndex);

  for (const skill of profile.skills) {
    const normalizedSkill = normalizeText(skill);
    if (!normalizedSkill) {
      continue;
    }

    const preferredProject =
      findProjectForSkill(normalizedSkill, projectIndex) ??
      fallbackProject;
    if (!preferredProject) {
      continue;
    }

    map.set(normalizedSkill, preferredProject);
    for (const token of tokenize(skill)) {
      if (token.length >= 4 && !map.has(token)) {
        map.set(token, preferredProject);
      }
    }
  }

  return map;
}

function findProjectForSkill(skillTerm: string, projectIndex: ProjectIndex[]): ProfileProject | undefined {
  for (const index of projectIndex) {
    if (getProjectEvidenceUrls(index.project).length === 0) {
      continue;
    }
    if (index.searchableTerms.some((term) => containsTerm(term, skillTerm) || containsTerm(skillTerm, term))) {
      return index.project;
    }
  }
  return undefined;
}

function findFallbackEvidenceProject(projectIndex: ProjectIndex[]): ProfileProject | undefined {
  const workHistoryProject = projectIndex.find((entry) =>
    getProjectEvidenceUrls(entry.project).some((url) => /\/work-history\/?$/i.test(url))
  );
  if (workHistoryProject) {
    return workHistoryProject.project;
  }

  return projectIndex.find((entry) => getProjectEvidenceUrls(entry.project).length > 0)?.project;
}

function containsTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  const synonymGroup = findSynonymGroup(normalizedTerm);
  if (synonymGroup) {
    return synonymGroup.some((candidate) => textContainsCandidate(normalizedText, candidate));
  }

  return textContainsCandidate(normalizedText, normalizedTerm);
}

function textContainsCandidate(normalizedText: string, candidate: string): boolean {
  if (candidate.includes(" ")) {
    return normalizedText.includes(candidate);
  }

  const pattern = new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i");
  return pattern.test(normalizedText);
}

function findSynonymGroup(term: string): string[] | null {
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(term)) {
      return group;
    }
  }
  return null;
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampScore(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}
