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
}

export interface ProfileProject {
  name: string;
  tags: string[];
  summary: string;
  outcomes: string[];
  stack: string[];
  evidence_urls: string[];
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

const JAPANESE_HARD_CAP = 60;
const ONSITE_HARD_CAP = 70;

const SYNONYM_GROUPS: string[][] = [
  ["change management", "adoption", "enablement", "training"],
  ["prompt engineering", "llm prompting", "prompt design"],
  ["agentic workflows", "agents", "ai orchestration"],
  ["digital transformation", "dx", "modernization"]
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
  requestId: string
): AnalyzeResponse {
  const projectIndex = buildProjectIndex(profile);
  const skillEvidence = buildSkillEvidenceMap(profile, projectIndex);
  const domainTerms = buildDomainTerms(profile);

  const sections = splitIntoSections(jdText);
  const allLines = extractLines(jdText);

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
    skillEvidence
  );
  const mustHavesEval = evaluateSection(
    requirementLines,
    RUBRIC_WEIGHTS.mustHaves,
    "Must-haves",
    projectIndex,
    skillEvidence
  );

  const niceEval =
    sections.nice_to_have.length > 0
      ? evaluateSection(
          sections.nice_to_have,
          RUBRIC_WEIGHTS.niceToHaves,
          "Nice-to-haves",
          projectIndex,
          skillEvidence
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

  const confidence = calculateConfidence(strengths);

  const fitSummary = buildFitSummary(score, confidence, strengths.length, gaps.length, riskEval.riskFlags);

  return {
    request_id: requestId,
    score,
    confidence,
    fit_summary: fitSummary,
    strengths,
    gaps,
    risk_flags: riskEval.riskFlags,
    rubric_breakdown: rubricBreakdown
  };
}

export function calculateConfidence(strengths: Strength[]): Confidence {
  const strongEvidenceByCategory = new Set(strengths.map((item) => item.area)).size;
  if (strongEvidenceByCategory >= 3) {
    return "High";
  }
  if (strongEvidenceByCategory >= 1) {
    return "Medium";
  }
  return "Low";
}

export function validateAnalyzeBody(body: unknown): string | null {
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
    if (!Array.isArray(typed.evidence_urls)) {
      throw new Error("Invalid profile data: project.evidence_urls must be an array");
    }
  }

  return profile as Profile;
}

function evaluateSection(
  lines: string[],
  weight: number,
  label: string,
  projectIndex: ProjectIndex[],
  skillEvidence: SkillEvidenceMap
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

  for (const line of sanitizedLines) {
    const evidenceProject = findBestEvidenceProject(line, projectIndex, skillEvidence);
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

  const addRiskFlag = (message: string): void => {
    if (!riskFlags.includes(message)) {
      riskFlags.push(message);
    }
  };
  const triggerHardGate = (message: string, cap: number): void => {
    addRiskFlag(message);
    hardScoreCap = typeof hardScoreCap === "number" ? Math.min(hardScoreCap, cap) : cap;
  };

  const jdRequiresOnsite =
    /(onsite only|on site only|must be located|relocat(e|ion) required|in office five days|5 days onsite|5 days on site|in-office)/i.test(
      jdText
    );
  const profilePrefersRemote = /remote|hybrid/.test(normalizedLocation);

  if (jdRequiresOnsite && profilePrefersRemote) {
    triggerHardGate(
      `Hard gate: JD appears onsite-required but profile location preference suggests remote/hybrid. Score capped at ${ONSITE_HARD_CAP}.`,
      ONSITE_HARD_CAP
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
      `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${JAPANESE_HARD_CAP}.`,
      JAPANESE_HARD_CAP
    );
    score -= 2;
  }
  if (profileRequiresJapaneseFluent && !jdMentionsJapanese) {
    triggerHardGate(
      `Hard gate: Profile indicates Japanese-fluent requirement, but JD does not include Japanese requirement. Score capped at ${JAPANESE_HARD_CAP}.`,
      JAPANESE_HARD_CAP
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

  for (const skill of profile.skills) {
    const normalizedSkill = normalizeText(skill);
    if (normalizedSkill.length >= 3) {
      domainSet.add(normalizedSkill);
    }
    for (const token of tokenize(skill)) {
      if (token.length >= 4) {
        domainSet.add(token);
      }
    }
  }

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
    if (index.project.evidence_urls.length === 0) {
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
    entry.project.evidence_urls.some((url) => /\/work-history\/?$/i.test(url))
  );
  if (workHistoryProject) {
    return workHistoryProject.project;
  }

  return projectIndex.find((entry) => entry.project.evidence_urls.length > 0)?.project;
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
