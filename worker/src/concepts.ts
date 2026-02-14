/**
 * Deterministic concept clusters for semantic JD matching.
 * These are fixed lists used by both deterministic scoring and AI interpreter.
 */

export interface ConceptCluster {
  id: string;
  label: string;
  terms: string[];
  weight: number;
  sections: Array<"must_haves" | "responsibilities" | "nice_to_have">;
}

/**
 * Semantic concept clusters for capability/skill matching.
 * AI is ONLY allowed to use cluster names from this list.
 * Export as both CLUSTERS and CONCEPT_CLUSTERS for compatibility.
 */
export const CLUSTERS: ConceptCluster[] = [
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

// Export as CONCEPT_CLUSTERS for compatibility with existing analysis.ts code
export const CONCEPT_CLUSTERS = CLUSTERS;

/**
 * Allowed cluster IDs for AI validation.
 * AI output must only use cluster names from this set.
 */
export const ALLOWED_CLUSTER_IDS = new Set(
  CLUSTERS.map(c => c.id)
);

/**
 * Domain-specific terms for domain fit scoring (not generic tech skills).
 * AI is allowed to reference these for domain matching.
 */
export const DOMAIN_TERMS = [
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

/**
 * Generic technical terms that should NOT count for domain fit.
 * These are explicitly excluded from domain scoring.
 */
export const TECH_EXCLUDE_TERMS = new Set([
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

/**
 * Synonym groups for term expansion.
 * Used for flexible matching while maintaining determinism.
 */
export const SYNONYM_GROUPS: string[][] = [
  ["change management", "adoption", "enablement", "training"],
  ["prompt engineering", "llm prompting", "prompt design"],
  ["agentic workflows", "agents", "ai orchestration"],
  ["digital transformation", "dx", "modernization"]
];
