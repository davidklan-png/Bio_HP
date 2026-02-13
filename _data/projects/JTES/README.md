# 🇯🇵 Japanese Tax Expert System

[![MVP Status](https://img.shields.io/badge/Status-MVP%20Complete-success)](https://github.com/davidklan-png/JapaneseTaxExpertSystem/issues/121)
[![Beta Ready](https://img.shields.io/badge/Release-Beta%20Ready-blue)](docs/archive/planning/mvp-readiness-evaluation-2025-12-13.md)
[![Milestones](https://img.shields.io/badge/Milestones-14%2F18%20Complete-brightgreen)](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestones)
[![Frontend Tests](https://github.com/davidklan-png/JapaneseTaxExpertSystem/actions/workflows/frontend-tests.yml/badge.svg)](https://github.com/davidklan-png/JapaneseTaxExpertSystem/actions/workflows/frontend-tests.yml)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20WSL2-blue)](docs/operations/platform-specific/macos-development.md)

An expert system for Japanese tax law and accounting analysis, designed to help business owners and consultants understand and apply Japan's tax rules efficiently using AI and automation.

**✅ MVP COMPLETE** - Ready for beta deployment (December 2025)

---

## 🧠 Overview

This project aims to build a **Retrieval-Augmented Generation (RAG)** system that combines:
- Japanese tax laws and government guidance (法令XML, PDFs)
- Accounting and corporate data
- Local semantic search and question-answering
- A conversational tutor interface for tax interpretation

The long-term goal is to automate tax research, improve compliance accuracy, and support financial decision-making.

---

## 🧩 Tech Stack

| Layer | Tool / Framework | Purpose |
|-------|------------------|----------|
| **RAG Framework** | [LlamaIndex](https://github.com/run-llama/llama_index) | Document ingestion, indexing, and retrieval orchestration |
| **Vector Database** | [ChromaDB](https://www.trychroma.com/) | Stores embeddings and enables semantic document retrieval |
| **Frontend** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Material UI](https://mui.com/) | Modern web interface for querying and visualization |
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) | RESTful API for RAG queries and administration |
| **OCR / Text Extraction** | [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) with modular backend abstraction | Extracts text from scanned/image-based PDFs with per-page quality gates |
| **PDF Parser** | [pdfplumber](https://github.com/jsvine/pdfplumber) | Extracts Japanese text from structured PDF law documents |
| **XML Parser** | `parse_law_xml` (custom) | Parses e-Gov 法令XML and extracts `<ItemSentence>` content |
| **Embeddings Model** | `ruri-v3 (310M)` | Japanese language embeddings for semantic retrieval |
| **LLM** | Anthropic Claude / OpenAI GPT | Natural-language reasoning and response generation |
| **Infrastructure** | Linux / macOS (Apple Silicon) / WSL2 | Cross-platform development and runtime environment |

---

## 🧱 Project Structure

```
JTES/
│
├── rag_system/           # Core RAG system (Python)
│   ├── api/             # FastAPI backend
│   ├── ingestion/       # Document processing (including OCR)
│   ├── retrieval/       # Query engine
│   ├── orchestrator/    # RAG pipeline
│   ├── llm/            # LLM adapters (Claude, OpenAI, etc.)
│   ├── vectorstore/    # ChromaDB adapter
│   └── sources/        # Source fetching from NTA
│
├── frontend/            # React + Vite frontend
│   ├── src/
│   │   ├── pages/      # Main pages (Query, Documents, Admin)
│   │   ├── components/ # Reusable UI components
│   │   └── lib/        # API client and utilities
│   └── package.json
│
├── scripts/             # Utility scripts
├── tests/              # Test suites
├── docs/               # Documentation
├── data/               # Local data storage
├── bin/                # Launcher scripts (jtes_api, jtes_fetch, etc.)
└── requirements.txt    # Python dependencies
```

## 📖 Documentation & Branching

- **Documentation hub:** See [docs/README.md](docs/README.md) for the full documentation index, including architecture, operations, security, and roadmap materials. New contributors should start with the [Developer Onboarding Guide](docs/development/ONBOARDING_GUIDE.md) and the [Operations Runbook](docs/operations/OPERATIONS_RUNBOOK.md).
- **Architecture snapshot:** A concise, current diagram is available in [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md).
- **OCR Architecture:** For details on the modular OCR system with quality gates and caching, see [docs/architecture/OCR_ARCHITECTURE.md](docs/architecture/OCR_ARCHITECTURE.md).
- **Branching model:**
  - `master` – production branch
  - `develop` – integration branch for feature work
  - `feat/**` and `codex/**` – feature and AI-assisted workstreams
- **Pull requests:** open PRs against `develop` when possible; use `master` only for production-ready hotfixes.

---

## ⚙️ Development Environment

| Tool | Role |
|------|------|
| **IDE** | VSCode / PyCharm (Python 3.11+ virtual environment) |
| **Frontend** | Node.js 18+, React, TypeScript |
| **Backend** | Python 3.11+, FastAPI |
| **Dependency Management** | `requirements.txt` (Python), `package.json` (Node) |
| **Testing Framework** | `pytest` (Python), Vitest (React) |
| **Version Control** | Git |
| **Data Storage** | `data/corpus/`, `data/indexes/` for vectorstore |

---

## 🧪 Setup Instructions

### 🚀 Quick Start (Recommended)

Use the restart agent script:

```bash
# Start all services (frontend on :3000, backend on :8001)
source venv/bin/activate && python scripts/restart_agent.py

# Or use the init script
./init.sh

# Stop all services
./init.sh stop

# Check status
./init.sh status
```

### 📋 Manual Setup (Development)

**Backend (Python):**
```bash
# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install the package in editable mode
pip install -e .

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys (ANTHROPIC_API_KEY or OPENAI_API_KEY)

# 4. Start the backend
uvicorn rag_system.api.fastapi_app:app --reload --port 8001
```

**Frontend (React):**
```bash
# 1. Install Node.js dependencies
cd frontend
npm install

# 2. Start the dev server
npm run dev

# 3. Access at http://localhost:3000
```

### 🐳 Docker Deployment (Recommended for Production)

```bash
# Copy environment file
cp .env.example .env
nano .env  # Add your ANTHROPIC_API_KEY

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Default Ports:**
| Service | Development | Production |
|---------|-------------|------------|
| React Frontend | 3000 | 3000 |
| FastAPI Backend | 8001 | 8000 |

### Verify Installation

```bash
# Test Python imports
python -c "from rag_system.ingestion import ingest_documents; print('✓ Backend installation successful')"

# Verify OCR availability (optional)
tesseract --version
tesseract --list-langs | grep jpn

# Run tests
pytest tests/ -v
```

For detailed installation instructions, see [INSTALL.md](INSTALL.md).

## 🖥️ Platform Support

JTES supports multiple platforms with automatic hardware detection and optimization:

### Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** | ✅ Fully Supported | Native Docker with host networking |
| **macOS (Apple Silicon)** | ✅ Fully Supported | M1/M2/M3/M4 chips with MPS acceleration |
| **macOS (Intel)** | ⚠️ Experimental | Requires CPU-only inference |
| **WSL2** | ✅ Fully Supported | Windows Subsystem for Linux |
| **Windows** | ⚠️ Limited | Use WSL2 or Docker Desktop |

### Platform-Specific Guides

- **macOS:** See [macOS Development Guide](docs/operations/platform-specific/macos-development.md) for Apple Silicon setup
- **Linux:** Use standard installation (above)
- **Docker:** Automatic platform detection in `docker-compose.yml`

### Hardware-Aware Configuration

JTES automatically detects your hardware and optimizes performance:

- **GPU Acceleration:** CUDA (NVIDIA) or MPS (Apple Silicon)
- **Batch Sizes:** Auto-adjusted based on available memory
- **Model Selection:** Optimal embedding model for your hardware

```python
from rag_system.utils.hardware import get_device_info

# Check your detected hardware
hw = get_device_info()
print(f"Hardware: {hw.cpu_name}, {hw.total_ram_gb:.0f}GB RAM")
print(f"GPU: {hw.gpu_name or 'None'}")
print(f"Acceleration: {hw.acceleration_type.value}")
```

### Operations quick reference

- **Environment variables:** At minimum set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Full reference: [docs/configuration/ENVIRONMENT_VARIABLES.md](docs/configuration/ENVIRONMENT_VARIABLES.md).
- **Start services (dev):** `npm run dev` (frontend) and `uvicorn rag_system.api.fastapi_app:app --reload --port 8001` (backend).
- **Health checks:** FastAPI exposes `/health` and `/api/admin/health` on port 8001.
- **Logs:** Structured logs write to `logs/` directory.

---

## 🚀 Roadmap

**Development is tracked via GitHub Issues and Milestones.**
View all issues: https://github.com/davidklan-png/JapaneseTaxExpertSystem/issues
Development workflow: [docs/development/DEVELOPMENT_WORKFLOW.md](docs/development/DEVELOPMENT_WORKFLOW.md)

### Milestones (2025 Q1-Q2)

| Milestone | Focus | Due Date | Issues |
|-----------|-------|----------|--------|
| **M1 - Integrity Foundation** | Security validators, fingerprinting | 2025-02-15 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/5) |
| **M2 - Transactional Core** | Document registry, chunking, 2PC | 2025-03-01 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/6) |
| **M3 - Consistency Engine** | Vectorstore consistency, auto-heal | 2025-03-15 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/7) |
| **M4 - Monitoring & Health** | Metrics, health checks, logging | 2025-04-01 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/8) |
| **M5 - Security Layer** | Secrets, rate limiting | 2025-04-15 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/9) |
| **M6 - RAG Integration** | LLM adapters, prompt templates, orchestration | 2025-05-01 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/10) |
| **M7 - Frontend & DevOps** | Admin UI, auth, CI/CD, deployment | 2025-05-15 | [View Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/milestone/11) |

### Current Status (2025-12-10)

**✅ 10 Milestones Complete (56% of tracked milestones):**
- **M1 - Integrity Foundation** (4/4 issues) - Document fingerprinting, security validators
- **M2 - Transactional Core** (8/8 issues) - Document registry, chunking, 2PC
- **M3 - Consistency Engine** (8/8 issues) - Vectorstore consistency, auto-heal
- **M5 - Security Layer** (3/3 issues) - Secrets manager, rate limiting
- **M6 - RAG Integration** (8/8 issues) - LLM adapters, prompt templates, orchestration
- **M15 - Vectorstore Reliability** (5/5 issues) - ChromaDB operations
- **M16 - Source Watcher** (4/4 issues) - Automated source monitoring
- **M17 - RAG Orchestration** (4/4 issues) - Complete RAG pipeline
- **M18 - Frontend Upgrade** (3/3 issues) - React frontend with Material UI components
- **M19 - MCP Tools Upgrade** (3/3 issues) - QueryEngine integration with logging

**✅ MVP Complete** (December 2025) - [View Full Evaluation](docs/archive/planning/mvp-readiness-evaluation-2025-12-13.md)

All 11 MVP acceptance criteria satisfied ([Issue #121](https://github.com/davidklan-png/JapaneseTaxExpertSystem/issues/121)):
- ✅ Ingestion reliability with deduplication and fingerprinting
- ✅ RAG orchestrator with deterministic retrieval and LLM provider abstraction
- ✅ Functional pipeline tests (55 security tests, 80% pass rate)
- ✅ Configuration & secrets management (no plaintext secrets)
- ✅ CI/CD with automated testing (>80% coverage)
- ✅ Security features (auth, rate limiting, validation, XXE protection)
- ✅ Monitoring & observability (Prometheus metrics, structured logging)
- ✅ Admin dashboard with source management and fetch operations
- ✅ Developer documentation (architecture, runbooks, operations guide)
- ✅ Automated rollback with canary deployment
- ✅ Component documentation and prompt templates

**📊 Milestone Progress:** 14/18 complete (78%)

**🚀 Ready For:**
- Beta release to 5-10 users
- Limited production deployment
- External user testing and feedback

**📦 v2.0 Roadmap:**
Advanced features (section-level citations, immutable versioning, citation integrity gates) planned for Q2 2026 based on beta feedback. See [Epic #153](https://github.com/davidklan-png/JapaneseTaxExpertSystem/issues/153) and [v2.0 planning docs](docs/archive/planning/v2.0/).

For detailed project baseline, see [project-baseline-2025-12-10.md](docs/archive/planning/project-baseline-2025-12-10.md)

### Epics

View all epics (labeled `epic`): [GitHub Issues](https://github.com/davidklan-png/JapaneseTaxExpertSystem/labels/epic)

**✅ Completed Epics:**
1. **#13** - Ingestion V2 ✅
2. **#14** - Document Registry & Fingerprinting ✅
3. **#15** - Transactional Processing Pipeline ✅
4. **#121** - MVP Acceptance Criteria ✅ (Dec 2025)

**📦 Future Epics (v2.0):**
- **#153** - Production RAG Architecture (Q2 2026) - Section-level citations, immutable versioning, citation integrity gates
4. **#16** - Vectorstore Consistency Manager ✅
5. **#18** - Security Hardening ✅
6. **#19** - RAG Orchestrator & LLM Integration ✅

**🔄 Active Epics:**
7. **#17** - Monitoring & Observability (M4)
8. **#20** - Frontend Admin Enhancements (M7)
9. **#21** - Deployment & CI/CD (M7)

---

## 🧭 Future Enhancements
- Add Japanese accounting datasets and corporate filings
- Introduce tax computation modules
- Integrate voice/chat interface
- Add secondary embedding model (JaFIn or domain-tuned variant)
- Create audit log and explanation layer for compliance review
- **GLM-OCR Backend** (Milestone 2) - Vision model-based OCR for higher accuracy on complex layouts

---

## 📜 License
This project is currently private and under development. Licensing terms will be defined before release.

---

## 👤 Author
**David Klan**  
Consultant, Dazbeez, LLC  
📧 [david.klan@gmail.com](mailto:david.klan@gmail.com)  
📞 +81-90-8266-9210

---

## 🤖 Agent Handover Notes (2026-02-13)

This `JTES/` folder in the portfolio repo is reference material used for project context and writeups. Treat it as documentation snapshot content unless explicitly asked to synchronize with the upstream `JapaneseTaxExpertSystem` repository.

- Portfolio-rendered JTES content is controlled by:
  - `_data/projects/jtes_specialized_rag.yml`
  - `projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals.md`
- When updating screenshot captions in YAML, quote strings that contain `:` to prevent YAML parse failures in GitHub Pages.
- Validate all `_data/**/*.yml` files before pushing changes that affect the static site build.
