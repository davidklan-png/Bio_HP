import profileData from "../../shared/profile.json";

type Confidence = "Low" | "Medium" | "High";

type SectionName =
  | "responsibilities"
  | "requirements"
  | "nice_to_have"
  | "languages"
  | "general";

interface Env {
  ALLOWED_ORIGINS?: string;
  RATE_LIMITER: DurableObjectNamespace;
}

interface AnalyzeRequestBody {
  jd_text: string;
}

interface Strength {
  area: string;
  evidence_title: string;
  evidence_url: string;
  rationale: string;
}

interface Gap {
  area: string;
  why_it_matters: string;
  mitigation: string;
}

interface RubricItem {
  category: string;
  score: number;
  weight: number;
  notes: string;
}

interface AnalyzeResponse {
  score: number;
  confidence: Confidence;
  fit_summary: string;
  strengths: Strength[];
  gaps: Gap[];
  risk_flags: string[];
  rubric_breakdown: RubricItem[];
}

interface ProfileProject {
  name: string;
  tags: string[];
  summary: string;
  outcomes: string[];
  stack: string[];
  evidence_urls: string[];
}

interface ProfileConstraints {
  location: string;
  languages: string[];
  availability: string;
}

interface Profile {
  skills: string[];
  projects: ProfileProject[];
  constraints: ProfileConstraints;
}

interface ProjectIndex {
  project: ProfileProject;
  searchableTerms: string[];
}

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
}

interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RiskEvaluation extends SectionEval {
  riskFlags: string[];
  hardScoreCap?: number;
}

const MAX_JD_CHARS = 15_000;
const MAX_CONTENT_LENGTH = 30_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const HARD_GATE_SCORE_CAP = 60;

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

const PROFILE: Profile = parseAndValidateProfile(profileData);
const PROJECT_INDEX: ProjectIndex[] = buildProjectIndex(PROFILE);
const DOMAIN_TERMS: string[] = buildDomainTerms(PROFILE);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/analyze") {
      return jsonError(404, "Not found", {});
    }

    const origin = request.headers.get("Origin");
    const cors = resolveCors(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      if (origin && !cors.isAllowed) {
        return jsonError(403, "Origin is not allowed", cors.headers);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...cors.headers,
          "content-length": "0"
        }
      });
    }

    if (origin && !cors.isAllowed) {
      return jsonError(403, "Origin is not allowed", cors.headers);
    }

    if (request.method !== "POST") {
      return jsonError(405, "Method not allowed", cors.headers);
    }

    const ip = getClientIp(request);
    let rate: RateLimitDecision;
    try {
      rate = await applyRateLimit(env.RATE_LIMITER, ip);
    } catch {
      return jsonError(503, "Rate limiter unavailable. Try again shortly.", cors.headers);
    }
    const rateHeaders = buildRateHeaders(rate.remaining, rate.resetAt);

    if (!rate.allowed) {
      return jsonError(429, `Rate limit exceeded. Retry in ${rate.retryAfterSeconds} seconds.`, {
        ...cors.headers,
        ...rateHeaders,
        "Retry-After": String(rate.retryAfterSeconds)
      });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError(415, "Content-Type must be application/json", {
        ...cors.headers,
        ...rateHeaders
      });
    }

    const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
      return jsonError(413, `Payload too large. Max ${MAX_CONTENT_LENGTH} bytes.`, {
        ...cors.headers,
        ...rateHeaders
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Malformed JSON body", { ...cors.headers, ...rateHeaders });
    }

    const validationError = validateAnalyzeBody(body);
    if (validationError) {
      return jsonError(400, validationError, { ...cors.headers, ...rateHeaders });
    }

    const jdText = (body as AnalyzeRequestBody).jd_text.trim();
    const analysis = analyzeJobDescription(jdText, PROFILE);

    return jsonResponse(200, analysis, { ...cors.headers, ...rateHeaders });
  }
};

function analyzeJobDescription(jdText: string, profile: Profile): AnalyzeResponse {
  const sections = splitIntoSections(jdText);
  const allLines = extractLines(jdText);

  const responsibilityLines = sections.responsibilities.length > 0 ? sections.responsibilities : allLines;
  const requirementLines = sections.requirements.length > 0 ? sections.requirements : allLines;

  const responsibilitiesEval = evaluateSection(
    responsibilityLines,
    RUBRIC_WEIGHTS.responsibilities,
    "Responsibilities"
  );
  const mustHavesEval = evaluateSection(requirementLines, RUBRIC_WEIGHTS.mustHaves, "Must-haves");

  const niceEval =
    sections.nice_to_have.length > 0
      ? evaluateSection(sections.nice_to_have, RUBRIC_WEIGHTS.niceToHaves, "Nice-to-haves")
      : {
          score: Math.round(RUBRIC_WEIGHTS.niceToHaves * 0.5),
          notes: "No explicit nice-to-have section found; assigned neutral midpoint.",
          matches: [],
          misses: []
        };

  const domainEval = evaluateDomainFit(jdText, RUBRIC_WEIGHTS.domainFit);
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

  const strengths = collectStrengths([
    ["Responsibilities", responsibilitiesEval],
    ["Must-haves", mustHavesEval],
    ["Nice-to-haves", niceEval],
    ["Domain fit", domainEval]
  ]);

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
  const score =
    typeof riskEval.hardScoreCap === "number" ? Math.min(rawScore, riskEval.hardScoreCap) : rawScore;

  const strongEvidenceByCategory = new Set(strengths.map((item) => item.area)).size;
  const confidence: Confidence =
    strongEvidenceByCategory >= 3 ? "High" : strongEvidenceByCategory >= 1 ? "Medium" : "Low";

  const fitSummary = buildFitSummary(score, confidence, strengths.length, gaps.length, riskEval.riskFlags);

  return {
    score,
    confidence,
    fit_summary: fitSummary,
    strengths,
    gaps,
    risk_flags: riskEval.riskFlags,
    rubric_breakdown: rubricBreakdown
  };
}

function evaluateSection(lines: string[], weight: number, label: string): SectionEval {
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

  for (const line of sanitizedLines) {
    const evidenceProject = findBestEvidenceProject(line);
    if (evidenceProject) {
      matches.push({ line, evidenceProject });
    } else {
      matches.push({ line });
      misses.push(line);
    }
  }

  const linesWithEvidence = matches.filter((m) => m.evidenceProject).length;
  const coverage = linesWithEvidence / sanitizedLines.length;
  const score = clampScore(Math.round(weight * coverage), 0, weight);

  const notes = `${linesWithEvidence}/${sanitizedLines.length} ${label.toLowerCase()} items have direct portfolio evidence.`;

  return { score, notes, matches, misses };
}

function evaluateDomainFit(jdText: string, weight: number): SectionEval {
  const normalizedJd = normalizeText(jdText);
  const matchedTerms: string[] = [];
  const matches: LineMatch[] = [];

  for (const term of DOMAIN_TERMS) {
    if (!containsTerm(normalizedJd, term)) {
      continue;
    }

    const project = findBestEvidenceProject(term);
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

  const addRiskFlag = (message: string): void => {
    if (!riskFlags.includes(message)) {
      riskFlags.push(message);
    }
  };
  const triggerHardGate = (message: string): void => {
    addRiskFlag(message);
    hardScoreCap = HARD_GATE_SCORE_CAP;
  };

  const jdRequiresOnsite =
    /(onsite only|on site only|must be located|relocat(e|ion) required|in office five days|5 days onsite|5 days on site|in-office)/i.test(
      jdText
    );
  const jdRequiresRemote = /(remote only|fully remote|must work remotely|100% remote)/i.test(jdText);
  const profilePrefersRemote = /remote|hybrid/.test(normalizedLocation);
  const profileOnsiteOnly = /onsite only|on site only|office only|in office/.test(normalizedLocation);

  if (jdRequiresOnsite && profilePrefersRemote) {
    triggerHardGate(
      `Hard gate: JD appears onsite-required but profile location preference suggests remote/hybrid. Score capped at ${HARD_GATE_SCORE_CAP}.`
    );
    score -= 2;
  }
  if (jdRequiresRemote && profileOnsiteOnly) {
    triggerHardGate(
      `Hard gate: JD appears remote-required but profile location preference suggests onsite-only. Score capped at ${HARD_GATE_SCORE_CAP}.`
    );
    score -= 2;
  }

  const requiredLanguages = detectLanguageRequirements(normalizedJd);
  const profileLanguages = constraints.languages.map((lang) => normalizeText(lang));
  for (const language of requiredLanguages) {
    if (!profileLanguages.includes(language)) {
      addRiskFlag(`No evidence found for required language: ${language}.`);
      score -= 2;
    }
  }

  const jdRequiresJapaneseFluent =
    /((fluent|fluency|business|native|professional|advanced).{0,24}japanese|japanese.{0,24}(fluent|fluency|business|native|professional|advanced|required)|jlpt\s*n1|japanese\s*n1)/i.test(
      jdText
    );
  const profileHasJapaneseFluent = constraints.languages.some((entry) => {
    const normalized = normalizeText(entry);
    const mentionsJapanese = /\bjapanese\b/.test(normalized);
    const fluentSignal = /\b(fluent|fluency|business|native|professional|advanced|n1)\b/.test(normalized);
    return mentionsJapanese && fluentSignal;
  });
  const profileRequiresJapaneseFluent = constraints.languages.some((entry) => {
    const normalized = normalizeText(entry);
    return /\b(require|required|must)\b/.test(normalized) && /\bjapanese\b/.test(normalized);
  });
  const jdMentionsJapanese = /\bjapanese\b/i.test(jdText);

  if (jdRequiresJapaneseFluent && !profileHasJapaneseFluent) {
    triggerHardGate(
      `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${HARD_GATE_SCORE_CAP}.`
    );
    score -= 2;
  }
  if (profileRequiresJapaneseFluent && !jdMentionsJapanese) {
    triggerHardGate(
      `Hard gate: Profile indicates Japanese-fluent requirement, but JD does not include Japanese requirement. Score capped at ${HARD_GATE_SCORE_CAP}.`
    );
    score -= 2;
  }

  const contractOnly = /(contract only|short term contract|no full time)/i.test(jdText);
  if (contractOnly && constraints.availability.toLowerCase().includes("full-time")) {
    addRiskFlag("Availability may not align (JD appears contract-only).");
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

function collectStrengths(entries: Array<[string, SectionEval]>): Strength[] {
  const strengths: Strength[] = [];
  const seen = new Set<string>();

  for (const [area, evalResult] of entries) {
    const evidenced = evalResult.matches.filter((match) => match.evidenceProject?.evidence_urls.length);
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

    const evidenceUrl = project.evidence_urls[0];
    if (!evidenceUrl) {
      continue;
    }

    const key = `${area}:${project.name}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    strengths.push({
      area,
      evidence_title: project.name,
      evidence_url: evidenceUrl,
      rationale: `Matched JD requirement to project evidence via: "${truncate(best.line, 120)}".`
    });
  }

  return strengths.slice(0, 8);
}

function collectGaps(entries: Array<[string, SectionEval]>): Gap[] {
  const gaps: Gap[] = [];

  for (const [area, evalResult] of entries) {
    if (evalResult.misses.length === 0) {
      continue;
    }

    for (const missedLine of evalResult.misses.slice(0, 2)) {
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

function findBestEvidenceProject(input: string): ProfileProject | undefined {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) {
    return undefined;
  }

  let bestProject: ProfileProject | undefined;
  let bestScore = 0;

  for (const index of PROJECT_INDEX) {
    if (index.project.evidence_urls.length === 0) {
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
      bestProject = index.project;
    }
  }

  return bestScore > 0 ? bestProject : undefined;
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
  const withoutBullet = line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
  return withoutBullet;
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

  for (const project of profile.projects) {
    for (const tag of project.tags) {
      for (const token of tokenize(tag)) {
        if (token.length >= 4) {
          domainSet.add(token);
        }
      }
    }

    for (const token of tokenize(project.summary)) {
      if (token.length >= 5) {
        domainSet.add(token);
      }
    }
  }

  return Array.from(domainSet);
}

function containsTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(" ")) {
    return normalizedText.includes(normalizedTerm);
  }

  const pattern = new RegExp(`\\b${escapeRegex(normalizedTerm)}\\b`, "i");
  return pattern.test(normalizedText);
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

function validateAnalyzeBody(body: unknown): string | null {
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

  if (candidate.jd_text.length > MAX_JD_CHARS) {
    return `Field jd_text exceeds max length of ${MAX_JD_CHARS} characters`;
  }

  return null;
}

function parseAndValidateProfile(input: unknown): Profile {
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
    if (!Array.isArray(typed.evidence_urls)) {
      throw new Error("Invalid profile data: project.evidence_urls must be an array");
    }
  }

  return profile as Profile;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "unknown-ip";
}

async function applyRateLimit(
  rateLimiterNamespace: DurableObjectNamespace,
  ip: string
): Promise<RateLimitDecision> {
  const id = rateLimiterNamespace.idFromName(ip);
  const stub = rateLimiterNamespace.get(id);
  const response = await stub.fetch("https://rate-limiter.internal/check", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Rate limiter failure: ${response.status}`);
  }

  return (await response.json()) as RateLimitDecision;
}

function buildRateHeaders(remaining: number, resetAt: number): HeadersInit {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(remaining, 0)),
    "X-RateLimit-Reset": String(Math.floor(resetAt / 1000))
  };
}

function resolveCors(origin: string | null, allowedOriginsRaw?: string): {
  isAllowed: boolean;
  headers: HeadersInit;
} {
  const allowedOrigins = (allowedOriginsRaw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const wildcard = allowedOrigins.includes("*");
  const isAllowed =
    !origin || wildcard || (origin !== null && allowedOrigins.length > 0 && allowedOrigins.includes(origin));

  let allowOriginHeader = "";
  if (origin && (wildcard || allowedOrigins.includes(origin))) {
    allowOriginHeader = wildcard ? "*" : origin;
  } else if (!origin && wildcard) {
    allowOriginHeader = "*";
  } else if (allowedOrigins.length > 0) {
    allowOriginHeader = wildcard ? "*" : allowedOrigins[0] ?? "";
  }

  const headers: HeadersInit = {
    "Access-Control-Allow-Origin": allowOriginHeader,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  return { isAllowed, headers };
}

function jsonError(status: number, error: string, headers: HeadersInit): Response {
  return jsonResponse(status, { error }, headers);
}

function jsonResponse(status: number, payload: unknown, headers: HeadersInit): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

export class RateLimiterDO {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const existingHits = ((await this.state.storage.get<number[]>("hits")) ?? []).filter(
      (timestamp) => timestamp > windowStart
    );
    await this.state.storage.put("hits", existingHits);

    let allowed = true;
    if (existingHits.length >= RATE_LIMIT_MAX_REQUESTS) {
      allowed = false;
    } else {
      existingHits.push(now);
      await this.state.storage.put("hits", existingHits);
    }

    const oldestInWindow = existingHits[0] ?? now;
    const resetAt = oldestInWindow + RATE_LIMIT_WINDOW_MS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - existingHits.length);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000));

    const decision: RateLimitDecision = {
      allowed,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining,
      resetAt,
      retryAfterSeconds
    };

    return new Response(JSON.stringify(decision), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
