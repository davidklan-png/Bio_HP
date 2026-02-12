## JTES System Architecture

**Category:** Architecture Documentation
**Issue:** #119 - Generate system architecture documentation and diagrams
**Milestone:** M20 - Config Hardening
**Last Updated:** 2026-01-31
**Status:** Active

---

### Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Deployment Architecture](#deployment-architecture)
7. [Security Architecture](#security-architecture)
8. [API Architecture](#api-architecture)
9. [Embedding System Architecture](#embedding-system-architecture) ⭐ NEW

---

### Overview

The Japanese Tax Expert System (JTES) is a production-ready RAG (Retrieval-Augmented Generation) system designed to provide accurate, citation-backed answers to Japanese tax and corporate law queries.

**Core Capabilities:**
- Document ingestion (PDF, XML, HTML, JSON)
- **Modular embedding providers (Ruri-v3, Sarashina, ChromaDB default)** ⭐ NEW
- Semantic search with vector database
- LLM-powered answer generation
- Citation enforcement and validation
- Multi-source data management
- REST API for programmatic access
- React-based web interface with bilingual support (Japanese/English)

---

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        JTES System                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   Frontend   │         │   REST API   │                      │
│  │              │         │              │                      │
│  │   React      │◄───────►│  FastAPI     │                      │
│  │   (3000)     │         │   (8001)     │                      │
│  └──────┬───────┘         └──────┬───────┘                      │
│         │                        │                               │
│         └────────────┬───────────┘                               │
│                      │                                           │
│          ┌───────────▼──────────┐                                │
│          │   RAG Orchestrator   │                                │
│          │                      │                                │
│          │  • Query Processing  │                                │
│          │  • Retrieval         │                                │
│          │  • Answer Generation │                                │
│          │  • Validation        │                                │
│          └──┬────────────────┬──┘                                │
│             │                │                                   │
│    ┌────────▼──────┐    ┌───▼───────────┐                       │
│    │   Retrieval   │    │  LLM Adapters │                       │
│    │               │    │               │                       │
│    │ • QueryEngine │    │ • OpenAI      │                       │
│    │ • Vectorstore │    │ • Ollama      │                       │
│    └────────┬──────┘    └───────────────┘                       │
│             │                                                    │
│    ┌────────▼──────────────┐                                    │
│    │  Data Layer           │                                    │
│    │                       │                                    │
│    │  • ChromaDB           │                                    │
│    │  • Document Registry  │                                    │
│    │  • SQLite DBs         │                                    │
│    └───────┬───────────────┘                                    │
│            │                                                     │
│    ┌───────▼────────────┐                                       │
│    │  Ingestion Engine  │                                       │
│    │                    │                                       │
│    │  • Document Parser │                                       │
│    │  • Chunker         │                                       │
│    │  • Fingerprinting  │                                       │
│    └───────┬────────────┘                                       │
│            │                                                     │
│    ┌───────▼─────────────┐                                      │
│    │  Source Management  │                                      │
│    │                     │                                      │
│    │  • Source Watcher   │                                      │
│    │  • File Watcher     │                                      │
│    │  • Fetchers         │                                      │
│    └─────────────────────┘                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Component Architecture

#### 1. **Frontend Layer**

**React Single Page Application** (`frontend/src/`)
- **Framework**: React 19.2 with TypeScript
- **Build Tool**: Vite 7.2
- **UI Library**: Material UI v7 (MUI) with Emotion styling
- **State Management**: Zustand for client state
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router v7
- **PDF Rendering**: PDF.js integration

**Entry Points:**
- `pages/QueryPage.tsx`: Natural language query interface
- `pages/DocumentsPage.tsx`: Document library browser
- `pages/LoginPage.tsx`: Authentication entry point
- `pages/DocumentViewerPage.tsx`: Dedicated document viewing page

**Admin Pages** (`pages/admin/`):
- `AdminDashboard.tsx`: Main admin dashboard
- `IngestionPage.tsx`: Document ingestion management
- `MetricsPage.tsx`: System metrics and monitoring
- `VectorstorePage.tsx`: ChromaDB vector store management
- `LLMProvidersPage.tsx`: LLM provider configuration
- `SystemHealthPage.tsx`: Health checks and diagnostics
- `AuditLogsPage.tsx`: Security audit log viewer
- `RetrievalConfigPage.tsx`: Retrieval parameter tuning
- `DocumentReviewPage.tsx`: Document review workflow
- `CategorySummaryPage.tsx`: Document categorization
- `WeeklyChangesPage.tsx`: Weekly change reports
- `APIMonitoringPage.tsx`: API usage monitoring
- `TestExecutionPage.tsx`: Test execution interface

**Query Components** (`components/query/`):
- `QueryComposer.tsx`: Query input and submission
- `AnswerPanel.tsx`: LLM answer display
- `CitationPanel.tsx`: Citation rendering and navigation
- `ProvenanceDrawer.tsx`: Source document provenance
- `TraceView.tsx`: RAG pipeline trace visualization
- `EvidencePanel.tsx`: Evidence chunk display
- `DocumentViewer.tsx`: In-context document viewing
- `TemporalControls.tsx`: Time-based query controls

**Document Components** (`components/document/`):
- `PdfViewer.tsx`: PDF rendering
- `XmlViewer.tsx`: XML document viewing
- `JsonViewer.tsx`: JSON document viewing
- `TextViewer.tsx`: Plain text viewing
- `EnhancedDocumentViewer.tsx`: Unified document viewer

**Common Components** (`components/common/`):
- `Layout.tsx`: App layout wrapper
- `ProtectedRoute.tsx`: Route guard for authenticated pages

**Features:**
- Bilingual support (Japanese/English) with i18n
- Role-based access control (Admin, Developer, User)
- Real-time query processing with loading states
- Document viewer with chunk navigation
- Dynamic backend port discovery via Vite proxy

#### 2. **API Layer**

**FastAPI Application** (`rag_system/api/fastapi_app.py`)
- REST API endpoints for programmatic access
- API key authentication
- Rate limiting integration
- CORS support
- OpenAPI documentation (Swagger/ReDoc)

**Key Management** (`rag_system/api/api_key_manager.py`)
- Secure key generation (SHA-256 hashing)
- Permission scopes (read/write/admin/all)
- Usage tracking and expiration
- Multi-tenancy support

**Authentication** (`rag_system/api/auth_router.py`, `rag_system/auth/`)
- API key-based authentication with optional OIDC integration
- Role-based access control (RBAC)
- Session management with secure token handling
- SSO provider support (`sso_provider.py`)
- User store backend (`user_store.py`)

**Usage Metering** (`rag_system/api/usage_metering.py`)
- Request/token/document tracking
- Usage quotas and limits
- Billing/cost calculation
- Analytics and reporting

#### 3. **RAG Orchestrator**

**Core Orchestration** (`rag_system/orchestrator/control_plane.py`)
- Query preprocessing
- Document retrieval via QueryEngine
- Context assembly
- LLM invocation
- Response validation
- Provenance storage
- Pipeline stage management with retry logic

**Workflow:**
```
Query → Preprocessing → Retrieval → Context → LLM → Validation → Response
```

#### 4. **Retrieval Layer**

**Query Engine** (`rag_system/retrieval/query_engine.py`)
- Semantic search with top-k retrieval
- ChromaDB integration
- Metadata filtering
- Query preprocessing

**Vector Store** (`rag_system/vectorstore/chroma_adapter.py`)
- ChromaDB wrapper
- Persistent storage
- Collection management
- Embedding generation
- Configurable embedding providers (Ruri, Sarashina, ChromaDB default)

#### 5. **LLM Integration**

**Provider Abstraction** (`rag_system/llm/`)
- `adapters/`: Provider implementations (Claude, OpenAI, Ollama)
- `provider_factory.py`: Runtime provider switching
- `failover_adapter.py`: Automatic failover between providers
- `strategies.py`: LLM invocation strategies
- `config.py`, `provider_config.py`: Configuration management

**Prompt Management** (`rag_system/llm/prompts/`)
- Few-shot prompt templates (`builder.py`)
- Citation-heavy prompting
- Japanese/English support

**Response Validation** (`rag_system/llm/validation/`)
- Citation enforcement (`response_validator.py`)
- Hallucination detection
- Format validation

#### 6. **Ingestion Engine**

**Document Processing** (`rag_system/ingestion/`)
- `DocumentParser`: Multi-format parsing (PDF, XML, HTML, JSON)
- `SemanticChunker`: Text chunking with overlap
- `DocumentRegistry`: SQLite-based registry with fingerprinting

**Pipeline:**
```
Document → Parse → Chunk → Fingerprint → Registry → Vectorstore
```

#### 7. **Source Management**

**Source Watcher** (`rag_system/sources/source_watcher.py`)
- Automated source monitoring
- HTTP fetching with robots.txt compliance
- Domain-specific rate limiting
- Content type detection

**File Watcher** (`rag_system/sources/file_watcher.py`)
- inotify-based file system monitoring
- Automatic ingestion triggers
- Debounce logic

#### 8. **Security Layer**

**Input Validation** (`rag_system/security/validators/`)
- PDF validator (magic number, structure)
- XML security (XXE prevention)
- Unicode validator (normalization, homoglyph detection)
- Path validator (traversal prevention)

**Rate Limiting** (`rag_system/security/rate_limiter.py`)
- Token bucket algorithm
- Per-key rate limiting
- Sliding window strategy

**Secrets Management** (`rag_system/security/secrets_manager.py`)
- Backend abstraction
- Environment backend (default)
- Future: AWS Secrets Manager, Vault, Azure Key Vault

#### 9. **Configuration**

**Modular Config System** (`rag_system/config/`)
- `base.py`: Pydantic-based configuration with validation
- `settings.py`: Backwards-compatible settings (uses base.py)
- `env_loader.py`: .env file loading

**Config Sections:**
- Database (ChromaDB, SQLite paths)
- Data directories
- Retrieval parameters
- LLM settings
- Rate limiting
- Security
- Source/file watchers
- Logging
- API/Streamlit settings

#### 10. **Monitoring & Observability**

**Structured Logging** (`rag_system/monitoring/`)
- JSON formatter
- Request/trace ID propagation (contextvars)
- Security & performance logging
- Audit trails

**Health Checks** (`rag_system/monitoring/health.py`)
- Liveness endpoint
- Readiness endpoint
- Dependency checks

**Metrics** (Prometheus integration ready)
- Request counts
- Latency histograms
- Error rates

---

### Data Flow

#### Query Flow

```
1. User submits query
   ↓
2. Query preprocessing
   - Sanitization
   - Normalization
   ↓
3. Vector search (ChromaDB)
   - Embedding generation
   - Similarity search
   - Top-k retrieval
   ↓
4. Context assembly
   - Document chunks
   - Metadata
   ↓
5. LLM invocation
   - Prompt construction
   - API call (OpenAI/Ollama)
   ↓
6. Response validation
   - Citation check
   - Hallucination detection
   ↓
7. Response return
   - Answer text
   - Citations
   - Retrieved documents
```

#### Ingestion Flow

```
1. Document arrival
   (Source Watcher / File Watcher / Manual upload)
   ↓
2. Document parsing
   - Format detection
   - Text extraction
   - Metadata extraction
   ↓
3. Fingerprinting
   - SHA-256 content hash
   - Structure hash
   - Metadata hash
   ↓
4. Deduplication check
   - Registry lookup
   - Skip if duplicate
   ↓
5. Chunking
   - Semantic chunking
   - Overlap configuration
   - Metadata preservation
   ↓
6. Embedding generation
   - OpenAI embeddings API
   ↓
7. Vector storage
   - ChromaDB insert
   - Collection update
   ↓
8. Registry update
   - Document record
   - Status tracking
```

---

### Technology Stack

**Core Technologies:**
- **Backend Language**: Python 3.11+
- **Frontend**: React 19.2 with TypeScript, Vite 7.2
- **Web Framework**: FastAPI
- **Vector DB**: ChromaDB
- **LLM**: Anthropic Claude, OpenAI API, Ollama
- **Database**: SQLite
- **Embeddings**: Ruri-v3 (Japanese-optimized), Sarashina (opt-in), ChromaDB default

**Key Libraries:**
- **Backend**:
  - `LangChain`: RAG orchestration
  - `Pydantic`: Data validation
  - `FastAPI`: REST API framework
  - `Prometheus Client`: Metrics
- **Frontend**:
  - `React`: UI framework
  - `Material UI (MUI)`: Component library
  - `TanStack Query`: Server state management
  - `Zustand`: Client state management
  - `Axios`: HTTP client
  - `PDF.js`: Document viewing

**Infrastructure:**
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Structured logging, Prometheus-ready
- **Deployment**: Multi-stage Docker builds, Health checks

---

### Deployment Architecture

#### Docker Deployment

```
┌─────────────────────────────────────────────┐
│         Docker Compose Stack                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  jtes-backend Container            │    │
│  │                                    │    │
│  │  • FastAPI (8001)                  │    │
│  │  • RAG System                      │    │
│  └─────────┬──────────────────────────┘    │
│            │                                │
│  ┌─────────▼──────────────────────────┐    │
│  │  jtes-frontend Container           │    │
│  │                                    │    │
│  │  • React + Vite (3000)             │    │
│  │  • Nginx/Static serving            │    │
│  └────────────────────────────────────┘    │
│            │                                │
│  ┌─────────▼──────────────────────────┐    │
│  │  Volumes                           │    │
│  │                                    │    │
│  │  • /app/data    (documents)        │    │
│  │  • /app/chroma_db (vectorstore)    │    │
│  │  • /app/logs    (logs)             │    │
│  └────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

**Multi-Stage Build:**
1. **Builder**: Install dependencies, compile packages
2. **Runtime**: Copy artifacts, minimal runtime image

**Health Checks:**
- HTTP endpoint: `/health` (FastAPI backend)
- Frontend health: Static file serving check
- Startup grace period: 30s
- Check interval: 30s

#### CI/CD Pipeline

**GitHub Actions Workflows:**
1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Code quality (ruff, black, isort)
   - Type checking (mypy)
   - Test suite (pytest)
   - Security audit (bandit, safety)
   - Build package

2. **Canary Deployment** (`.github/workflows/canary.yml`)
   - Deploy to 10% traffic
   - Monitor for 15 minutes
   - Auto-rollback on errors

3. **Rollback** (`.github/workflows/rollback.yml`)
   - One-click rollback
   - <5 minute rollback SLA
   - Automatic health checks

4. **Hotfix Pipeline** (`.github/workflows/hotfix.yml`)
   - Fast-track deployment
   - <1 hour bug-to-production
   - Critical tests only (<5 min)

---

### Security Architecture

#### Authentication & Authorization

**API Authentication:**
- API key-based (X-API-Key header)
- Key management with SQLite backend
- Permission scopes (read/write/admin/all)
- Key expiration and rotation

**Frontend Authentication:**
- Token-based authentication (JWT/OIDC)
- Role-based access control (Admin, Developer, User)
- Session management with Zustand
- Secure token storage (HttpOnly cookies)

#### Input Validation

**Validation Layers:**
1. **PDF Validator**: Magic number, structure checks
2. **XML Validator**: XXE prevention, DTD disabled
3. **Unicode Validator**: Normalization, homoglyph detection
4. **Path Validator**: Traversal prevention
5. **Query Sanitization**: Injection prevention

#### Rate Limiting

**Rate Limit Strategies:**
- Token bucket algorithm
- Sliding window
- Per-key limits
- Domain-specific limits (source fetching)

**Quotas:**
- Request quotas (per key, per period)
- Token usage quotas
- Document retrieval quotas

#### Security Headers

**API Security:**
- CORS with allowlist
- Content-Type enforcement
- Request timeout limits

---

### API Architecture

#### REST API Endpoints

**Query Endpoints:**
- `POST /api/v1/query` - Submit natural language query
- `GET /api/v1/documents/count` - Get document count

**Health Endpoints:**
- `GET /health` - Liveness check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics
- `GET /info` - API information

**Documentation:**
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc documentation

#### Python SDK

**Client Library** (`sdk/python/jtes_sdk/`)
- Synchronous client (`JTESClient`)
- Asynchronous client (`AsyncJTESClient`)
- Type hints (Pydantic models)
- Automatic retry logic
- Error handling

**Usage:**
```python
from jtes_sdk import JTESClient

with JTESClient(api_key="jtes_key") as client:
    response = client.query("法人番号とは？")
    print(response.answer)
```

---

### Performance Considerations

**Optimization Strategies:**
1. **Caching**: Document embeddings cached
2. **Connection Pooling**: HTTP connection reuse
3. **Batch Processing**: Bulk ingestion support
4. **Lazy Loading**: On-demand resource initialization
5. **Async Operations**: Async API client available

**Scalability:**
- Horizontal scaling: Multiple FastAPI workers
- Vertical scaling: Configurable worker count
- Database scaling: ChromaDB persistence layer

---

### Future Enhancements

**v2.0 Roadmap** (see `docs/archive/planning/v2.0/`):
- Section-level citations (not document-level)
- Immutable data versioning with snapshots
- Release bundle registry (git-based YAML)
- Citation integrity gates
- Evaluation pack infrastructure
- Multi-tenancy architecture
- SSO integration (SAML, OAuth)
- Custom branding & theming

---

### References

- **Planning Docs**: `docs/planning/`
- **v2.0 Architecture**: `docs/archive/planning/v2.0/ARCH_GAP_REPORT.md`
- **API Documentation**: `/docs` (Swagger UI)
- **Developer Guide**: `docs/DEVELOPER_GUIDE.md`

---

### Embedding System Architecture ⭐ NEW (M23)

**Added:** 2025-12-31
**Purpose:** Modular, configurable embedding providers for Japanese semantic search

#### Overview

The embedding system provides a pluggable interface for different embedding models, allowing easy switching between providers via configuration. This addresses the critical limitation where ChromaDB's default English-only embedding model (all-MiniLM-L6-v2) performed poorly on Japanese tax documents.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Embedding Provider Factory                  │
│                                                             │
│  EMBEDDING_PROVIDER env var → get_embedding_provider()    │
│                                                             │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐        │
│  │  Ruri    │  │ Sarashina  │  │ Chroma Default   │        │
│  │ (Apache) │  │ (Non-Comm) │  │ (English only)   │        │
│  └────┬─────┘  └─────┬──────┘  └────┬─────────────┘        │
│       │             │                │                     │
│       └─────────────┴────────────────┘                     │
│                     │                                      │
│              EmbeddingProvider Interface                   │
│                     │                                      │
│        ┌────────────▼─────────────┐                        │
│        │  ChromaDB Adapter (v2)  │                        │
│        │  - Provider wrapper     │                        │
│        │  - Dimension validation │                        │
│        └────────────┬─────────────┘                        │
│                     │                                      │
└─────────────────────┼──────────────────────────────────────┘
                      │
          ┌───────────▼──────────┐
          │   ChromaDB           │
          │   (Collection with   │
          │    embedding metadata)│
          └──────────────────────┘
```

#### Available Providers

| Provider | Model | Dimension | License | Commercial | Recommended |
|----------|-------|-----------|---------|------------|-------------|
| **ruri** (DEFAULT) | cl-nagoya/ruri-v3-310m | 768 | Apache 2.0 | ✅ Yes | **Production Japanese** |
| ruri (tiny) | cl-nagoya/ruri-v3-pt-30m | 768 | Apache 2.0 | ✅ Yes | Faster inference |
| sarashina | sbintuitions/sarashina-embedding-v2-1b | 1792 | Non-Commercial | ❌ No | Research only |
| chroma_default | all-MiniLM-L6-v2 | 384 | Apache 2.0 | ✅ Yes | English text only |

#### Module Structure

**Package:** `rag_system/embeddings/`

```
rag_system/embeddings/
├── __init__.py                 # Package exports
├── base.py                     # EmbeddingProvider abstract interface
├── ruri_adapter.py             # Ruri-v3 provider (DEFAULT) ⭐
├── sarashina_adapter.py        # Sarashina v2 provider (opt-in)
├── chroma_default_adapter.py   # ChromaDB fallback
└── factory.py                  # Provider factory with config
```

**Integration:** `rag_system/vectorstore/chroma_adapter_v2.py`
- New ChromaStore with configurable embedding provider
- ProviderEmbeddingFunction wrapper
- Dimension validation and collection metadata

#### Configuration

**Environment Variables:**

```bash
# Provider selection (in .env)
EMBEDDING_PROVIDER=ruri  # Default (recommended)
# Options: ruri, sarashina, chroma_default

# Ruri model variant (optional)
RURI_MODEL_NAME=cl-nagoya/ruri-v3-310m
# Options: cl-nagoya/ruri-v3-310m, cl-nagoya/ruri-v3-pt-30m

# Device configuration
EMBEDDING_DEVICE=cpu  # or cuda
EMBEDDING_BATCH_SIZE=32
```

#### Key Features

**1. Config-Only Switching**
- Change providers via environment variable
- No code modifications required
- Dynamic provider loading

**2. Dimension Validation**
- Collections store embedding dimension in metadata
- ChromaStore validates on initialization
- Prevents mixing incompatible embeddings

**3. Collection Segregation**
```
# Different collections for different embeddings
jtes_documents_ruri_768    # Ruri embeddings
jtes_documents_sarashina_1792  # Sarashina embeddings (if used)
jtes_documents_default_384  # Legacy ChromaDB default
```

**4. License Enforcement**
- Sarashina requires explicit opt-in: `EMBEDDING_PROVIDER=sarashina`
- Raises ValueError if not acknowledged
- Commercial use warnings in logs

**5. Backward Compatibility**
- Original `chroma_adapter.py` unchanged
- New `chroma_adapter_v2.py` with provider support
- Existing collections remain functional

#### Usage Examples

**Basic Usage (Config-Driven):**
```python
from rag_system.vectorstore.chroma_adapter_v2 import ChromaStore

# Uses provider from EMBEDDING_PROVIDER env var (defaults to Ruri)
store = ChromaStore()
print(f"Model: {store.embedding_provider.get_model_name()}")
print(f"Dimension: {store.dimension}")
```

**Explicit Provider:**
```python
from rag_system.embeddings import get_embedding_provider
from rag_system.vectorstore.chroma_adapter_v2 import ChromaStore

provider = get_embedding_provider("ruri")
store = ChromaStore(embedding_provider=provider)
```

**Ingestion with New Embeddings:**
```python
# Create new collection with Ruri embeddings
store = ChromaStore(collection_name="jtes_documents_ruri")
store.add_documents(texts=["法人番号とは..."], ids=["doc_1"])
```

#### Migration Path

**From ChromaDB Default to Ruri:**

```bash
# 1. Install dependencies
pip install -r requirements-embeddings.txt

# 2. Configure Ruri
export EMBEDDING_PROVIDER=ruri

# 3. Create new collection
python -c "
from rag_system.vectorstore.chroma_adapter_v2 import ChromaStore
store = ChromaStore(collection_name='jtes_documents_ruri')
print(f'Ready: {store.dimension} dimensions')
"

# 4. Re-index corpus
python scripts/ingest_tranche2_corpus.py

# 5. Verify improved retrieval
python scripts/compare_retrieval.py
```

#### Dependencies

**New Requirements:** `requirements-embeddings.txt`
```
sentence-transformers>=2.2.0
torch>=2.0.0
fugashi>=1.3.0  # Japanese tokenizer
```

**Installation:**
```bash
pip install -r requirements-embeddings.txt
```

#### Testing & Benchmarks

**Unit Tests (Pending):**
```bash
pytest tests/unit/test_embeddings.py -v
```

**Integration Tests (Pending):**
```bash
pytest tests/integration/test_ruri_embeddings.py -v
```

**Benchmarks (Pending):**
```bash
python scripts/bench_embeddings.py --provider ruri
```

#### License Information

**Ruri-v3:**
- License: Apache 2.0
- Commercial use: Permitted ✅
- Source: [cl-nagoya/ruri-v3-310m](https://huggingface.co/cl-nagoya/ruri-v3-310m)
- Paper: [arXiv:2409.07737](https://arxiv.org/html/2409.07737v1)

**Sarashina v2:**
- License: Sarashina NonCommercial License
- Commercial use: Prohibited ❌
- Source: [sbintuitions/sarashina-embedding-v2-1b](https://huggingface.co/sbintuitions/sarashina-embedding-v2-1b)
- For research/evaluation only

#### References

- Implementation Guide: `docs/retrieval/RURI_SARASHINA_EMBEDDING_INTEGRATION.md`
- Factory: `rag_system/embeddings/factory.py`
- Base Interface: `rag_system/embeddings/base.py`
- ChromaDB Integration: `rag_system/vectorstore/chroma_adapter_v2.py`

---
