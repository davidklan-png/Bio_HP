/**
 * AI Interpreter for semantic JD parsing.
 *
 * Maps JD text to concept clusters, domain signals, and language requirements.
 * Output is strictly JSON - no narrative text, no evidence URLs, no project names.
 */

import { CONCEPT_CLUSTERS, DOMAIN_TERMS, ALLOWED_CLUSTER_IDS } from "./concepts";

export interface ParsedJD {
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  languages: string[];
  general: string[];
}

export interface InterpreterOutput {
  cluster_targets: {
    required: string[];  // Cluster IDs that match must-haves
    nice_to_have: string[];  // Cluster IDs that match nice-to-haves
  };
  domain_signal: {
    matched: boolean;
    terms: string[];
  };
  language_requirements: string[];  // Languages detected in JD
  risk_flags: string[];  // Purely language/domain constraint issues
  ai_used: boolean;
  ai_model: string;
}

/**
 * Interpret JD using AI to identify semantic targets.
 *
 * @param env - The worker environment containing AI binding
 * @param parsedJD - Pre-parsed JD sections
 * @param aiModelId - Model to use for interpretation
 * @returns Interpreter output with cluster targets and domain signals
 */
export async function interpretJD(
  env: { AI?: any },
  parsedJD: ParsedJD,
  aiModelId: string
): Promise<InterpreterOutput> {
  // If AI is not available or not enabled, return deterministic fallback
  if (!env?.AI) {
    return deterministicFallback(parsedJD);
  }

  // Prepare JD text for AI (truncate if too long)
  const jdText = prepareJDText(parsedJD);

  try {
    const response = await env.AI.run(aiModelId, {
      prompt: buildInterpretationPrompt(jdText),
      response_format: { type: "json" }
    });

    if (!response.success || !response.result) {
      console.warn("AI interpretation failed or invalid response");
      return deterministicFallback(parsedJD);
    }

    const raw = response.result;
    let parsed: any;

    // Try to parse JSON response
    try {
      parsed = JSON.parse(raw as string);
    } catch {
      console.warn("AI returned invalid JSON, falling back to deterministic");
      return deterministicFallback(parsedJD);
    }

    // Validate AI output
    const validated = validateAIOutput(parsed);

    return {
      ...validated,
      ai_used: true,
      ai_model: aiModelId
    };
  } catch (error) {
    console.warn("AI interpretation error:", error);
    return deterministicFallback(parsedJD);
  }
}

/**
 * Prepare JD text for AI processing.
 * Combines all sections with clear labeling.
 */
function prepareJDText(parsedJD: ParsedJD): string {
  const parts: string[] = [];

  if (parsedJD.responsibilities.length > 0) {
    parts.push("=== RESPONSIBILITIES ===");
    parts.push(...parsedJD.responsibilities.slice(0, 20));
  }

  if (parsedJD.requirements.length > 0) {
    parts.push("=== REQUIREMENTS (MUST-HAVES) ===");
    parts.push(...parsedJD.requirements.slice(0, 15));
  }

  if (parsedJD.nice_to_have.length > 0) {
    parts.push("=== NICE-TO-HAVES ===");
    parts.push(...parsedJD.nice_to_have.slice(0, 10));
  }

  if (parsedJD.languages.length > 0) {
    parts.push("=== LANGUAGES ===");
    parts.push(...parsedJD.languages);
  }

  if (parsedJD.general.length > 0) {
    parts.push("=== GENERAL ===");
    parts.push(...parsedJD.general.slice(0, 10));
  }

  return parts.join("\n\n");
}

/**
 * Build the interpretation prompt.
 * Strictly asks for JSON output with allowed cluster IDs only.
 */
function buildInterpretationPrompt(jdText: string): string {
  const allowedIds = Array.from(ALLOWED_CLUSTER_IDS).sort().join(", ");

  return `You are a JD analysis assistant. Extract structured information from this job description.

=== JOB DESCRIPTION ===
${jdText}

=== INSTRUCTIONS ===
Return ONLY valid JSON. No additional text.

Allowed cluster IDs for "cluster_targets": ${allowedIds}

Output format:
{
  "cluster_targets": {
    "required": ["cluster_id1", "cluster_id2"],
    "nice_to_have": ["cluster_id3"]
  },
  "domain_signal": {
    "matched": true/false,
    "terms": ["domain_term1", "domain_term2"]
  },
  "language_requirements": ["English", "Japanese", ...],
  "risk_flags": ["constraint_issue1", ...]
}

Rules:
- cluster_ids must be from: ${allowedIds}
- Only include clusters actually mentioned in the JD
- domain_terms only for: ${DOMAIN_TERMS.slice(0, 10).join(", ")} etc.
- Do NOT include project names, company names, or URLs
- Do NOT invent years, metrics, or skills`;
}

/**
 * Validate AI output against constraints.
 */
function validateAIOutput(output: any): InterpreterOutput {
  const defaults: InterpreterOutput = {
    cluster_targets: { required: [], nice_to_have: [] },
    domain_signal: { matched: false, terms: [] },
    language_requirements: [],
    risk_flags: [],
    ai_used: false,
    ai_model: ""
  };

  if (!output || typeof output !== "object") {
    return defaults;
  }

  // Validate cluster_targets
  const clusterTargets = output.cluster_targets || {};
  if (!Array.isArray(clusterTargets.required)) {
    clusterTargets.required = [];
  }
  if (!Array.isArray(clusterTargets.nice_to_have)) {
    clusterTargets.nice_to_have = [];
  }

  // Filter to only allowed cluster IDs
  clusterTargets.required = (clusterTargets.required as string[]).filter(id =>
    ALLOWED_CLUSTER_IDS.has(id)
  );
  clusterTargets.nice_to_have = (clusterTargets.nice_to_have as string[]).filter(id =>
    ALLOWED_CLUSTER_IDS.has(id)
  );

  // Validate domain_signal
  const domainSignal = output.domain_signal || {};
  if (typeof domainSignal.matched !== "boolean") {
    domainSignal.matched = false;
  }
  if (!Array.isArray(domainSignal.terms)) {
    domainSignal.terms = [];
  }

  // Validate language_requirements
  if (!Array.isArray(output.language_requirements)) {
    output.language_requirements = [];
  }

  // Validate risk_flags
  if (!Array.isArray(output.risk_flags)) {
    output.risk_flags = [];
  }

  return {
    cluster_targets: clusterTargets,
    domain_signal: domainSignal,
    language_requirements: output.language_requirements || [],
    risk_flags: output.risk_flags || [],
    ai_used: true,
    ai_model: output.ai_model || ""
  };
}

/**
 * Deterministic fallback when AI is unavailable or fails.
 * Uses simple keyword matching.
 */
function deterministicFallback(parsedJD: ParsedJD): InterpreterOutput {
  const requiredClusters = new Set<string>();
  const niceToHaveClusters = new Set<string>();
  const domainTerms = new Set<string>();
  const languages = new Set<string>();

  const allText = [
    ...parsedJD.responsibilities,
    ...parsedJD.requirements,
    ...parsedJD.nice_to_have,
    ...parsedJD.general
  ].join(" ").toLowerCase();

  // Check for language requirements
  for (const lang of ["english", "japanese", "spanish", "french", "german", "mandarin", "cantonese", "korean"]) {
    if (allText.includes(lang)) {
      languages.add(lang.charAt(0).toUpperCase() + lang.slice(1));
    }
  }

  // Match clusters and domain terms
  for (const cluster of CONCEPT_CLUSTERS) {
    for (const term of cluster.terms) {
      if (allText.includes(term.toLowerCase())) {
        if (cluster.sections.includes("must_haves") || cluster.sections.includes("responsibilities")) {
          requiredClusters.add(cluster.id);
        } else if (cluster.sections.includes("nice_to_have")) {
          niceToHaveClusters.add(cluster.id);
        }
        break;
      }
    }
  }

  // Check domain terms
  for (const term of DOMAIN_TERMS) {
    if (allText.includes(term)) {
      domainTerms.add(term);
    }
  }

  return {
    cluster_targets: {
      required: Array.from(requiredClusters),
      nice_to_have: Array.from(niceToHaveClusters)
    },
    domain_signal: {
      matched: domainTerms.size > 0,
      terms: Array.from(domainTerms)
    },
    language_requirements: Array.from(languages),
    risk_flags: [],
    ai_used: false,
    ai_model: "deterministic"
  };
}
