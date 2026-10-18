# 🔍 AuditIQ Analytics Platform

> **AI-powered fraud & anomaly detection for enterprise audit workflows.**  
> Built for Deloitte Hackathon — production-credible architecture, inspired by **Material Dashboard React** style.

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![MaterialUI](https://img.shields.io/badge/MUI-v5-007FFF.svg)](https://mui.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)

---

## What it does

AuditIQ detects financial fraud and anomalies across two domains:

| Domain | What's detected |
|--------|-----------------|
| **Ledger / Vendor Payments** | Benford's Law violations · Near-duplicate invoices · PO–Invoice–GR 3-way match failures |
| **Financial Statements** | Beneish M-Score (earnings manipulation) · Altman Z-Score (bankruptcy risk) · Isolation Forest / LOF ratio anomalies |

**One shared detection core, two thin adapters.** Every exception gets a ranked score, a human-readable reason code, and a case-management status a reviewer can change live. All runs are audit-logged.

---

## Quick Start

### Option A — Docker Compose (recommended, works on Mac + Windows)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repo
git clone https://github.com/TanishqAtrey/audit-analytics-platform.git
cd "audit-analytics-platform"

# 2. Copy environment file
cp .env.example .env
# Edit .env if you want custom DB credentials (defaults work fine)

# 3. Start all services (DB + backend + React frontend)
make up
# or: docker compose up -d --build

# 4. Open the dashboard
open http://localhost:3000        # macOS
# or navigate to http://localhost:3000 in your browser
```

The first `make up` takes ~2 minutes to pull images and build. Subsequent starts are fast.

| Service | URL |
|---------|-----|
| **React Dashboard (MUI)** | http://localhost:3000 |
| **FastAPI Backend** | http://localhost:8000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **PostgreSQL** | `localhost:5432` (user: `auditiq`, pass: `auditiq_dev`) |

---

### Option B — Local Python + Node (frontend only, no backend required)

The frontend includes full mock data fallback — every page works without a running backend.

```bash
# 1. Install dependencies
cd dashboard
npm install

# 2. Start dev server
npm run dev
# or: make run-frontend-local
```

The dashboard will open at **http://localhost:3000** and run with rich mock data fallback.

---

## Makefile Commands

```bash
make up           # Start all Docker services (detached)
make down         # Stop all services
make rebuild      # Force-rebuild images and restart
make seed         # Seed demo data into Postgres
make reset-db     # Drop + recreate + reseed (safe mid-demo)
make test         # Run full test suite
make test-backend # Backend tests only
make logs         # Tail all service logs
make benchmark    # Run parallelism benchmark (generates benchmark lift stats)
make shell-backend# Shell into backend container
make shell-db     # psql shell into Postgres
make help         # List all available targets
```

---

## System Architecture & UML Design

### End-to-End Multi-Tier Architecture
![System Architecture](diagrams/fig1_system_architecture.png)

AuditIQ follows an enterprise three-tier architecture separating the React.js client interface, the Python FastAPI asynchronous analytical engine, and PostgreSQL persistence with SQLAlchemy ORM.

### Static Domain Architecture (UML Class Diagram)
![UML Class Diagram](diagrams/fig2_uml_class_diagram.png)

The core detection engine defines an abstract polymorphic `DetectionTest` interface. Sub-model adapters implement concrete inference logic, registered dynamically through `AdapterRegistry`, and aggregated via the calibrated soft-voting `EnsembleScorer`.

### Dynamic Execution Pipeline (UML Sequence Diagram)
![UML Sequence Diagram](diagrams/fig3_uml_sequence_diagram.png)

Asynchronous lifecycle trace: Client CSV upload → Defensive input sanitization → Database staging → Parallel thread pool scoring across adapters → Weighted ensemble consensus → Persistent exception generation → Live case triage.

---

## Platform Interface & Forensic Workflow

### 1. Active Anomaly Drivers & Vendor Outlier Spend
![Active Anomaly Drivers](diagrams/fig5_active_anomaly_drivers.png)
*Executive dashboard visualizing active anomaly drivers across accounts payable dimensions and highlighting high-risk vendor outlier expenditure.*

### 2. Exceptions Spotlight Scatter Matrix
![Exceptions Spotlight Scatter Matrix](diagrams/fig6_exceptions_spotlight.png)
*Interactive dual-axis scatter matrix plotting transaction monetary values against composite ensemble risk scores, demarcating low-risk, warning, and critical risk clusters.*

### 3. Forensic Exception Dossier & Case Triage
![Forensic Exception Dossier](diagrams/fig7_forensic_dossier.png)
*Granular exception dossier revealing exact sub-model score decomposition (Benford, Isolation Forest, LOF, Duplicate, Rules), transaction audit details, auditor notes, and lifecycle status transition controls (Open, In Review, Resolved, Dismissed).*

### 4. Detection Performance & Risk Zone Distribution
![Detection Performance](diagrams/fig4_detection_performance.png)
*Detection performance card demonstrating 87.5% True Positive Rate, 0.882 F1 score, risk zone distributions, and active detection pipeline status.*

---

## Project Structure

```
audit-analytics-platform/
├── backend/              # FastAPI detection engine
│   ├── api/              # Routes: ingest, detect, cases, audit, benchmark
│   ├── core/             # Shared engine: scorer, registry, reason_codes
│   ├── adapters/         # Ledger & financial-statement adapters
│   ├── ml/               # Isolation Forest + LOF wrappers
│   ├── validation/       # Precision/recall, benchmark, cross-validation
│   └── schemas/          # Pydantic request/response contracts
│
├── dashboard/            # React + Material UI + Recharts dashboard
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── theme.js      # MUI v5 custom styling
│       ├── api/
│       │   └── client.js # Axios API seam + mock data fallback
│       ├── components/   # Sidebar, Navbar, StatCard, ChartCard, status chips
│       └── pages/        # Dashboard, exceptions, threshold, log, about
│
├── data_infra/           # Database, ingestion, security
│   ├── db/               # schema.sql, models.py, connection.py
│   ├── security/         # env_validation.py, input_sanitization.py
│   └── scripts/          # seed_demo_data.py, reset_db.py, benchmark
│
├── docker-compose.yml    # Orchestrates backend + frontend + PostgreSQL
├── Dockerfile.backend
├── Dockerfile.frontend
├── Makefile
├── requirements.txt
└── .env.example
```

---

## Dashboard Pages

| Page | What you can do |
|------|----------------|
| **🏠 Dashboard** | Material Dashboard style widgets, live stats, Benford distribution, run timeline, status breakdown |
| **📋 Ledger Exceptions** | Fuzzy duplicates, 3-way matches, detailed weights, inline status selection, CSV download |
| **📊 Financial Exceptions** | Beneish M-Score vs Altman Z-Score scatter map, company status triage, formula cheat sheets |
| **🎚️ Threshold Explorer** | Composed precision/recall/F1 chart, live threshold preset recommendations |
| **📈 Benchmark** | Baseline single-test vs ensemble curve lift charts and comparative dataset logs |
| **📜 Audit Log** | Traceability logging, runtime profiling, CSV export |
| **📖 Methodology** | Full architecture layout, detection accoridons, datasource metrics, in-scope details |

---

## Technical Stack & Design Choices

- **Material Dashboard UI**: Styled with clean gradients, floating card shadows, and custom headers mimicking Google's Material Design principles.
- **Recharts Integration**: Native React charting widgets styled directly to match the dark theme and light-paper components.
- **Axios Fallback Layer**: Ensures the frontend remains fully interactive with mock datasets when the PostgreSQL backend is offline.
- **Docker Compose Orchestration**: Packs database, FastAPI backend, and React build servers in separate containers with shared volumes.
