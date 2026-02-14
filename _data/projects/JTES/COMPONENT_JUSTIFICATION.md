# JTES Architecture — Component Selection Justification

**Document:** Component Selection Rationale
**System:** Japanese Tax Expert System (JTES)
**Date:** 2026-02-14
**Related:** [Architecture Diagram](../../../assets/images/jtes-architecture-diagram.svg) | [System Architecture](ARCHITECTURE.md)

---

## Overview

This document explains why each major component in the JTES architecture was selected and why it is necessary for the final product. The system is a Retrieval-Augmented Generation (RAG) application that answers Japanese tax law questions for business owners and consultants, backed by authoritative government sources.

The architecture diagram (`../../../assets/images/jtes-architecture-diagram.svg`) shows the six-layer system structure. Below, each component is justified in terms of the specific problem it solves, why the chosen technology fits, and what alternatives were considered.

---

## 1. Presentation Layer — React 19 + TypeScript + Vite + Material UI

### What it does

The frontend provides three primary interfaces: a **query interface** where users submit natural language tax questions and receive cited answers, a **document browser** for navigating the ingested corpus of tax laws, and an **admin dashboard** for system management (ingestion, vectorstore health, LLM configuration, metrics, audit logs).

### Why React 19

React was selected because the JTES frontend requires a component-driven architecture with complex state interactions across multiple views (query results, citation panels, provenance drawers, document viewers). React's component model, combined with hooks for state management, provides the composability needed for a data-dense application. React 19's concurrent rendering features improve responsiveness when rendering large answer panels with embedded citations and source documents simultaneously.

Alternatives like Vue or Svelte would work for simpler UIs but offer fewer mature ecosystem libraries for the specific widget types JTES needs (data grids, charting, PDF rendering).

### Why TypeScript

Tax law software requires correctness. TypeScript catches structural errors at compile time—particularly important for the API client layer, where response shapes from the FastAPI backend must be accurately typed. The query response model includes nested citations, confidence scores, provenance data, and optional debug fields. Without static typing, silent shape mismatches between frontend and backend would be a persistent source of bugs.

### Why Vite

Vite provides sub-second hot module replacement during development, which matters for a frontend with 30+ components across query, document, and admin views. Its Rollup-based production builds produce optimized bundles. The alternative, Create React App (webpack-based), is effectively deprecated and significantly slower for both development and production builds.

### Why Material UI (MUI) v7

JTES needs data tables (document lists, audit logs), form controls (query composer, configuration panels), charting (metrics dashboards), and layout primitives. MUI provides all of these in a single coherent design system with accessibility (a11y) built in. Since JTES targets professional users (tax consultants, business owners), a business-application aesthetic is appropriate—MUI's default design language fits this use case without custom design work.

### Why Zustand + TanStack Query

JTES has two distinct state categories: **client state** (UI preferences, language selection, panel toggles) and **server state** (query results, document lists, health status). Zustand handles client state with minimal boilerplate—no Redux ceremony for what amounts to a handful of UI flags. TanStack Query handles server state with built-in caching, background refetching, and stale-while-revalidate semantics, which prevents redundant API calls when users navigate between views.

### Why this layer is necessary

Without a dedicated frontend, users would need to interact with the system via raw API calls or a command line. The target users—Japanese business owners and tax consultants—need a visual interface that displays answers with inline citations, lets them click through to source documents, and provides bilingual (Japanese/English) support. The admin dashboard is necessary for operational tasks like monitoring ingestion status, reviewing system health, and managing LLM provider configuration without SSH access.

---

## 2. API Gateway — FastAPI + Uvicorn

### What it does

The API layer exposes the RAG pipeline and all administrative functions as REST endpoints. It handles authentication, rate limiting, CORS, request validation, correlation ID generation, and structured error responses.

### Why FastAPI

FastAPI was selected for three reasons specific to JTES:

1. **Automatic OpenAPI documentation.** The `/docs` (Swagger) and `/redoc` endpoints are generated from Python type annotations. This is important because the JTES API has complex request/response models (nested citations, provenance chains, confidence metadata) that need accurate, always-current documentation for frontend developers.

2. **Async-native.** The RAG pipeline involves I/O-bound operations: ChromaDB queries, LLM API calls (Anthropic/OpenAI), and document retrieval. FastAPI's native `async/await` support allows concurrent request handling without thread pool overhead. A synchronous framework like Flask would bottleneck on LLM API latency.

3. **Pydantic integration.** FastAPI's deep integration with Pydantic v2 means request validation, response serialization, and configuration management all use the same type system. The JTES configuration layer (APIConfig, policy profiles, LLM provider config) is built on Pydantic, so the framework and application share a single validation model.

Django REST Framework was considered but rejected—its ORM-centric design adds overhead for a system that uses ChromaDB (not a relational database) as its primary datastore.

### Why Uvicorn

Uvicorn is the standard ASGI server for FastAPI applications. It provides the async event loop that FastAPI requires. Gunicorn with Uvicorn workers is used in production for multi-process scaling.

### Why the security middleware belongs here

Rate limiting, CORS, authentication, and input validation are implemented as FastAPI middleware and dependencies rather than as separate services. For a beta deployment (5-10 users), a dedicated API gateway (Kong, Traefik) would be over-engineered. The token-bucket rate limiter, API key validation, and CORS allowlist are sufficient at current scale and can be extracted to a gateway service if the system scales beyond hundreds of concurrent users.

### Why this layer is necessary

The frontend and any future integrations (MCP tools, external systems) need a stable API contract. Without a structured API layer, the RAG orchestrator would need to handle HTTP concerns (serialization, authentication, error formatting) directly, violating separation of concerns and making the core logic harder to test.

---

## 3. RAG Orchestrator — Control Plane

### What it does

The orchestrator coordinates the entire question-answering pipeline through a single entry point (`answer_query`). It executes a six-stage pipeline: query preprocessing, retrieval, evidence gating, context assembly, LLM invocation, and response validation. It enforces quality policies (evidence thresholds, citation verification) and records provenance for every query.

### Why a single entry point (Control Plane pattern)

All query processing goes through `answer_query()` regardless of the caller (API endpoint, admin tool, batch evaluation). This ensures:

- **Consistent quality gates.** Every answer passes through evidence gating and citation verification. There is no code path that bypasses validation.
- **Centralized policy enforcement.** Retrieval profiles (PILOT_BALANCED, PILOT_STRICT) and abstention rules are applied uniformly.
- **Complete provenance.** Every query is tracked with a correlation ID, retrieved document IDs, prompt text, model output, and timing metadata. This is a compliance requirement for a system providing tax guidance.

The alternative—distributing pipeline logic across API handlers—would create inconsistent behavior between different entry points and make provenance tracking fragile.

### Why fail-closed behavior (PILOT mode)

JTES provides tax law guidance. An incorrect answer about tax obligations can cause real financial harm. The system is designed to **abstain rather than hallucinate**: if retrieved evidence is insufficient, if citation verification fails, or if confidence is below threshold, the system returns an explicit "I cannot answer this" response with the reason. This is a deliberate trade-off of coverage for accuracy that is appropriate for a legal/financial domain.

### Why pipeline stages instead of a monolithic function

The six-stage pipeline (preprocess → retrieve → evidence gate → assemble → LLM invoke → validate) allows:

- **Independent testing** of each stage.
- **Policy-driven configuration** where thresholds can be tuned per stage without code changes.
- **Stage-level timing** for performance debugging (identifying whether latency comes from retrieval, LLM, or validation).
- **Short-circuiting** when evidence gating fails, avoiding unnecessary LLM API calls (and their cost).

### Why this layer is necessary

Without orchestration, the API layer would need to manually coordinate retrieval, LLM calls, validation, and provenance recording inline. This would make the query flow untestable as a unit, create duplicate logic across different endpoints, and make policy changes require code modifications in multiple places.

---

## 4. Retrieval Pipeline — Query Engine + Embeddings + Domain Classification

### What it does

The retrieval pipeline converts a user's natural language question into a set of relevant document chunks from the vector database. It supports multiple retrieval strategies (semantic, keyword, hybrid, category-enforced), automatically classifies queries into tax domains, and applies quality gates before passing results to the LLM.

### Why ChromaDB as the vector database

ChromaDB was selected over alternatives (Pinecone, Weaviate, Milvus, Qdrant) for these reasons:

1. **Local-first deployment.** JTES is designed for small-scale deployment (5-10 beta users) where a managed vector database service would add unnecessary cost and operational complexity. ChromaDB runs embedded in the Python process or as a local server.
2. **Zero infrastructure dependency.** No external service to provision, no network latency for vector queries, no vendor lock-in.
3. **Persistence.** ChromaDB persists to local disk (`data/indexes/`), surviving process restarts without re-indexing.
4. **Python-native API.** Direct integration with the FastAPI backend without SDK translation layers.

The trade-off is that ChromaDB has limited horizontal scaling. This is acceptable for the current user base. If JTES scales to hundreds of concurrent users, migration to Qdrant or Weaviate (both support distributed deployments) would be warranted.

### Why Ruri-v3 (310M) as the default embedding model

Standard English embedding models (e.g., `all-MiniLM-L6-v2`, OpenAI's `text-embedding-ada-002`) perform poorly on Japanese text, particularly legal Japanese with its specialized vocabulary (法人税, 消費税, 確定申告). Ruri-v3 is a 310M-parameter model from Nagoya University specifically trained on Japanese text, producing 768-dimensional embeddings optimized for Japanese semantic similarity.

Key factors:
- **Japanese-optimized:** Trained on Japanese corpora, understands legal terminology.
- **Apache 2.0 license:** Commercially deployable without licensing restrictions.
- **Reasonable size:** 310M parameters runs on CPU without GPU requirements, keeping infrastructure costs low.
- **768 dimensions:** Sufficient for capturing semantic nuance without excessive storage overhead.

Sarashina v2 (1B parameters, 1792 dimensions) is available as a research option but is non-commercial licensed, making it unsuitable for production deployment.

### Why multiple retrieval strategies

Different query types benefit from different retrieval methods:
- **Semantic search** works well for conceptual questions ("What are the requirements for blue return filing?").
- **Keyword search (BM25)** works well for specific term lookups ("消費税率 10%").
- **Hybrid** combines both for broad coverage.
- **Category-enforced** ensures diverse source representation, preventing over-weighting of popular document categories.

The query optimizer automatically selects the strategy based on query characteristics, so users don't need to understand retrieval mechanics.

### Why domain classification

Japanese tax law spans multiple domains (consumption tax, income tax, corporate tax, withholding, local taxes, inheritance, etc.). Domain classification allows the retrieval pipeline to:
- Focus search on relevant document categories, improving precision.
- Detect out-of-scope queries (e.g., questions about US tax law) and abstain early.
- Apply domain-specific retrieval parameters (different top-k values, similarity thresholds).

### Why this layer is necessary

The quality of RAG answers depends entirely on retrieval quality. Without a dedicated retrieval pipeline, the system would perform naive vector search without domain awareness, quality gating, or strategy optimization. This would produce lower-quality answers with irrelevant sources, undermining user trust in a domain where accuracy is critical.

---

## 5. LLM Integration Layer — Multi-Provider Adapters + Failover

### What it does

The LLM layer provides a provider-agnostic interface for answer generation. It supports Anthropic (Claude), OpenAI (GPT-4), Ollama (local models), and Zhipu (GLM), with automatic failover between providers and citation-heavy prompt management.

### Why multiple LLM providers

1. **Reliability.** LLM API outages happen. Automatic failover from Anthropic to OpenAI (or vice versa) prevents service interruptions for users.
2. **Cost flexibility.** Different providers have different pricing. The system can be configured to use Claude for high-quality answers and a cheaper model for simpler queries.
3. **Self-hosted option.** Ollama support allows deployment without any external API dependency, which matters for organizations with data residency requirements (Japanese tax documents may contain sensitive business information).
4. **Future-proofing.** The adapter pattern means new providers can be added without modifying the orchestrator or retrieval layers.

### Why citation-heavy prompting

JTES answers must be traceable to specific source documents. The prompt templates instruct the LLM to cite specific document sections, and the response validation stage verifies that citations reference actual retrieved documents. This is not optional decoration—it is a core quality requirement for a system providing tax guidance that users may rely on for business decisions.

### Why failover at the adapter level

Provider failover is implemented in the LLM layer (via `failover_adapter.py`) rather than at the API gateway level because:
- Different providers have different API shapes, error codes, and retry semantics.
- The failover logic needs to preserve the prompt context (which is provider-specific in format).
- Retry and backoff parameters differ by provider (Anthropic rate limits differ from OpenAI's).

### Why this layer is necessary

The LLM is the component that generates human-readable answers from retrieved context. Without it, the system would return raw document chunks—useful for search but not for question answering. The abstraction layer is necessary because no single LLM provider offers the reliability, cost efficiency, and deployment flexibility that JTES requires.

---

## 6. Document Ingestion Engine

### What it does

The ingestion engine processes raw documents (PDFs from the National Tax Agency, XML from e-Gov, HTML from government websites) into chunked, embedded, deduplicated entries in the vector database.

### Why domain-specific Japanese legal chunking

Generic text chunking (split every N tokens) destroys the semantic structure of Japanese legal documents. Tax laws are organized into articles (条), paragraphs (項), and items (号) with specific cross-references. The `JapaneseLegalChunker` recognizes this structure and produces chunks that preserve semantic coherence—a chunk contains a complete legal provision rather than an arbitrary text fragment. This directly improves retrieval quality because the vector embeddings represent meaningful legal concepts rather than arbitrary text spans.

### Why SHA-256 fingerprinting and deduplication

Japanese tax law documents are updated periodically. Without fingerprinting:
- Re-ingesting the same document would create duplicate entries, inflating the vector database and degrading retrieval quality (duplicate results).
- There would be no way to detect which documents have changed between ingestion runs.

SHA-256 content hashing provides deterministic deduplication and change detection with negligible computational cost.

### Why multi-format parsing (PDF, XML, HTML, OCR)

The source materials for Japanese tax law come in multiple formats:
- **PDF:** The most common format for NTA publications and guidance documents. Many are scanned images requiring OCR (Tesseract).
- **XML:** The 法令XML format used by e-Gov for official legal text.
- **HTML:** Web pages from NTA and tax authority websites.

Supporting all formats ensures comprehensive corpus coverage. Rejecting any format would leave gaps in the knowledge base.

### Why XXE protection (defusedxml)

XML documents from government sources must be parsed safely. Standard Python XML libraries (lxml, xml.etree) are vulnerable to XML External Entity (XXE) attacks by default. `defusedxml` disables DTD processing, external entity resolution, and entity expansion, preventing potential security issues when processing untrusted XML input. This is a non-negotiable security requirement.

### Why parallel ingestion with checkpoints

The JTES corpus contains hundreds to thousands of documents. Sequential processing would make full re-ingestion impractical. Parallel processing with adaptive batching and memory monitoring allows efficient ingestion. The checkpoint system enables resuming interrupted jobs, which is important for large ingestion runs that may take extended periods.

### Why this layer is necessary

Without ingestion, there is no data in the vector database, and the RAG pipeline has nothing to retrieve. The ingestion engine is the pipeline that transforms raw government documents into the searchable knowledge base that makes the entire system functional.

---

## 7. Data & Storage Layer — ChromaDB + SQLite + File System

### What it does

The storage layer persists three categories of data: vector embeddings (ChromaDB), structured metadata (SQLite document registry), and raw files (file system).

### Why three storage backends

Each storage type is optimized for its access pattern:
- **ChromaDB** stores high-dimensional vectors for similarity search. Relational databases cannot perform efficient approximate nearest neighbor search.
- **SQLite** stores structured metadata (document fingerprints, versions, provenance records, authentication data). This data is queried by exact match or range, which vector databases handle poorly.
- **File system** stores the original document corpus and application logs. These are large binary blobs (PDFs) that don't belong in either a vector database or SQLite.

### Why ChromaDB singleton pattern

A production incident (2026-01-10, Issue #344) demonstrated that multiple ChromaDB client instances cause Rust FFI race conditions leading to database corruption. The thread-safe singleton factory (`get_global_chroma_store()`) ensures exactly one ChromaDB client exists per process. This is a reliability requirement, not an optimization.

### Why this layer is necessary

Persistent storage is fundamental. Without ChromaDB, there are no vector embeddings to search. Without the document registry, there is no deduplication or provenance tracking. Without file system storage, there is no document corpus to ingest from.

---

## 8. Monitoring & Observability — Prometheus + Structured Logging + Health Checks

### What it does

The monitoring layer provides three capabilities: **metrics** (Prometheus counters and histograms), **structured logging** (JSON-formatted logs with correlation IDs), and **health checks** (liveness, readiness, and dependency health endpoints).

### Why Prometheus

Prometheus is the standard for application metrics in containerized deployments. JTES tracks request counts, latency histograms, error rates, and custom LLM metrics (token usage, provider distribution). These metrics are necessary for:
- Detecting performance regressions after updates.
- Monitoring LLM API costs.
- Identifying retrieval quality degradation.
- SLO tracking for beta users.

### Why structured JSON logging with correlation IDs

Tax law queries may require investigation if a user disputes an answer. Correlation IDs allow tracing a single query through every pipeline stage (API receipt → preprocessing → retrieval → LLM invocation → validation → response). JSON-structured logs are machine-parseable for aggregation and search.

### Why health checks

The Docker Compose deployment uses health checks to determine service readiness. The `/health` endpoint confirms the process is alive. The `/ready` endpoint confirms dependencies (ChromaDB, LLM providers) are accessible. The ChromaDB diagnostic endpoint detects database corruption states. Without these, the deployment system cannot distinguish between a healthy service and one that is running but non-functional.

### Why this layer is necessary

A system providing tax guidance to paying users requires operational visibility. Without monitoring, there is no way to detect degraded performance, track costs, investigate incorrect answers, or verify that deployments are healthy. This is a baseline operational requirement for any production service.

---

## 9. Infrastructure — Docker + GitHub Actions + Configuration Management

### What it does

The infrastructure layer provides containerized deployment (Docker Compose), automated testing and deployment (GitHub Actions CI/CD), and centralized configuration (Pydantic-based settings with environment variables and policy profiles).

### Why Docker Compose

JTES has three services (frontend, backend, ChromaDB) plus an optional service (Ollama). Docker Compose provides:
- **Reproducible environments** across development, staging, and production.
- **Service dependency management** (backend waits for ChromaDB to be healthy).
- **Network isolation** between services.
- **Volume persistence** for ChromaDB data across container restarts.

Kubernetes would be over-engineered for 5-10 beta users. Docker Compose is the appropriate orchestration tool at this scale.

### Why GitHub Actions

GitHub Actions provides CI/CD integrated with the source repository. JTES uses it for:
- Running quality gate tests on every PR.
- Security validation.
- Canary deployments with rollback support.

The alternative (Jenkins, CircleCI) would require additional infrastructure. GitHub Actions runs on GitHub's infrastructure with no setup cost.

### Why Pydantic-based configuration with policy profiles

JTES has over 40 configuration parameters (LLM keys, retrieval thresholds, rate limits, feature flags, ChromaDB settings). Pydantic provides:
- **Type validation** at startup—misconfigured values are caught before the server starts.
- **Environment variable loading** with `.env` file support.
- **Default values** that produce a working configuration out of the box.

Policy profiles (PILOT_BALANCED, PILOT_STRICT, DEBUG_LENIENT) allow changing retrieval behavior without code modifications, which is important for tuning quality thresholds during the beta period.

### Why this layer is necessary

Without containerization, deployment requires manually installing Python, Node.js, ChromaDB, and all dependencies on the target machine—error-prone and unreproducible. Without CI/CD, quality gates are only enforced when developers remember to run tests locally. Without centralized configuration, settings are scattered across code, environment variables, and config files with no validation.

---

## 10. Security Layer — Authentication + Rate Limiting + Input Validation

### What it does

The security layer spans multiple architectural tiers, providing API key authentication with RBAC, token-bucket rate limiting with tier-based quotas, input validation (query sanitization, PDF structure validation, XXE protection, Unicode normalization), and prompt injection prevention.

### Why API key + OIDC/OAuth

JTES needs two authentication mechanisms:
- **API keys** for programmatic access (scripts, integrations, MCP tools). Keys carry scopes (read, write, admin) for fine-grained access control.
- **OIDC/OAuth** for browser-based access through the frontend. This delegates identity management to external providers (Google, corporate SSO), avoiding the need to implement password storage.

### Why tier-based rate limiting

LLM API calls have direct cost. Without rate limiting:
- A single user could exhaust the LLM API budget.
- A misconfigured client could DoS the service.
- There is no mechanism for monetization (free vs. paid tiers).

The token-bucket algorithm with tier-based daily quotas (Free: 5 queries/day, Starter: 50, Professional: unlimited) balances accessibility with cost control.

### Why input validation at the API boundary

User-provided queries and uploaded documents are the system's attack surface:
- **Query sanitization** prevents prompt injection attacks that could cause the LLM to ignore its instructions.
- **PDF validation** prevents malformed files from crashing the parser.
- **XXE protection** prevents XML-based attacks.
- **Unicode normalization** prevents homoglyph attacks (visually similar characters used to bypass filters).

### Why this layer is necessary

JTES handles sensitive tax information and makes LLM API calls with real cost. Without authentication, anyone can access the system. Without rate limiting, costs are unbounded. Without input validation, the system is vulnerable to injection attacks, parser crashes, and data corruption. Security is a non-negotiable requirement for a system providing professional tax guidance.

---

## Summary

Every component in the JTES architecture addresses a specific requirement of a production RAG system for Japanese tax law:

| Layer | Core Requirement | Key Selection Criterion |
|-------|-----------------|------------------------|
| Frontend | Professional UI for non-technical users | React ecosystem maturity + MUI for business UIs |
| API Gateway | Stable contract + security boundary | FastAPI's async + Pydantic integration |
| Orchestrator | Consistent quality + auditability | Single entry point + fail-closed design |
| Retrieval | Japanese semantic search quality | Ruri-v3 embeddings + domain-aware retrieval |
| LLM Layer | Reliable, cited answer generation | Multi-provider failover + citation enforcement |
| Ingestion | Comprehensive corpus from govt. sources | Multi-format parsing + legal-aware chunking |
| Storage | Persistent, corruption-resistant data | ChromaDB (vectors) + SQLite (metadata) |
| Monitoring | Operational visibility | Prometheus + structured logging + health checks |
| Infrastructure | Reproducible deployment | Docker Compose + GitHub Actions CI/CD |
| Security | Access control + cost management | API key/OIDC + rate limiting + input validation |

No component exists without a specific justification tied to either the domain requirements (Japanese tax law), the technical requirements (RAG pipeline), or the operational requirements (beta deployment to real users).
