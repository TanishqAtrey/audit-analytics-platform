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

## System Architecture & Workflow

```mermaid
graph TD
    %% Input Layer
    A["📥 CSV / Excel<br/>Financial Data"] --> B["⚙️ Data Validation<br/>& Preprocessing"]
    
    %% Processing Splits
    subgraph Analysis ["Audit Analytical Engines"]
        C1["🔍 Transaction Analysis<br/>• Near-Duplicate Detection<br/>• Benford's Law Digits<br/>• Thresholding Filters"]
        C2["📊 Financial Analysis<br/>• Altman Z-Score Distress<br/>• Beneish M-Score (Manipulator)<br/>• Accounting Ratios"]
        C3["🤖 Machine Learning Outliers<br/>• Isolation Forest Anomaly<br/>• Local Outlier Factor Proximity"]
    end
    
    B --> C1
    B --> C2
    B --> C3
    
    %% Consolidation & Risk
    C1 --> D["🎯 Risk Engine Scorer<br/>(Weighted Composite: 0 — 100)"]
    C2 --> D
    C3 --> D
    
    %% Downstream Actions
    D --> E["📢 Explainability & Alert Engine<br/>(Reason Codes & Weights)"]
    E --> F["🏠 Interactive Dashboard<br/>(Auditor Case Triage)"]
    F --> G["🔄 Auditor Feedback Loop<br/>(False Positive & Fraud Seeding)"]
    
    %% Styling
    classDef input fill:#eceff1,stroke:#607d8b,stroke-width:2px,color:#000;
    classDef prep fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000;
    classDef analytic fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000;
    classDef scorer fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000;
    classDef alert fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000;
    classDef ui fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000;
    
    class A input;
    class B prep;
    class C1,C2,C3 analytic;
    class D scorer;
    class E,G alert;
    class F ui;
```

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
