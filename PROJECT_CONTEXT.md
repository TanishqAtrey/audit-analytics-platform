# Audit Analytics Platform — Project Context for AI Coding Agent

This document is the single source of truth for generating code for this project.
Read it fully before writing any file. It covers: what the product does, why each
technical decision was made, the exact file structure, what belongs in every file,
how the pieces connect, and the constraints you must respect while generating code.

---

## 1. What this project is

A fraud/anomaly detection platform for auditors, built as a hackathon project for
Deloitte, aimed at production-credible (not toy) code quality. It has **two
detection domains that share one detection engine**:

1. **Ledger domain** — transaction-level data (accounts payable / vendor
   payments). Detects: Benford's Law violations, duplicate/near-duplicate
   invoices, and PO–Invoice–Goods-Receipt (3-way match) mismatches.
2. **Financial statement domain** — company-level financial statement data
   (from SEC EDGAR). Detects: earnings-manipulation risk (Beneish M-Score),
   bankruptcy/distress risk (Altman Z-Score), and ratio-based anomalies via
   unsupervised ML.

The core product pitch: **one shared detection core, two thin adapters**. Both
domains feed a common interface (dataframe + test config → ranked, scored,
explained exception list). This is a real architectural claim, not a marketing
line — it must be reflected literally in the code structure (see `core/` vs
`adapters/` below).

Output for every domain is **not just a score** — every flagged item must come
with a human-readable reason (which sub-tests fired, and by how much), a status
a reviewer can change, and a way to compare the ensemble result against a naive
single-test baseline.

---

## 2. Full feature list (build all of these — nothing here is optional)

### Core detection features
- **Benford's Law ensemble**: 1st-digit test, 2nd-digit test, 1st-two-digit
  test, MAD (Mean Absolute Deviation), chi-square goodness-of-fit. Combine
  into one ensemble score, not a single test.
- **Duplicate/near-duplicate invoice detection**: fuzzy string matching
  (vendor name, invoice number, amount, date proximity) using `rapidfuzz`.
  Must use **blocking** (e.g. by vendor or amount bucket) before pairwise
  comparison — never do a naive O(n²) all-pairs comparison; it will not
  scale past ~50k rows on a laptop.
- **3-way match (PO–Invoice–Goods Receipt)**: rule-based logic (not ML) on
  synthetic data, since no real 3-way-match dataset exists at this
  granularity. Keep this module simple and clearly labeled as
  synthetic-data-validated.
- **Isolation Forest + Local Outlier Factor (LOF)**: both, from
  `scikit-learn`, run on both domains where applicable (ledger transaction
  features, and financial ratio features). Used to produce a "baseline vs
  ensemble lift" comparison, not just a single output.
- **Beneish M-Score and Altman Z-Score**: computed on real SEC EDGAR XBRL
  "company facts" data. Because XBRL tagging is inconsistent across
  companies, **do not build a fully generic "works for any ticker" parser**.
  Instead use a curated, hardcoded list of ~30–50 post-2009 public companies
  (mix of clean and SEC AAER-listed fraud cases). This is a deliberate scope
  decision — do not silently expand it into a generic parser.
- **Cross-validation against Kaggle credit-card fraud data**: this data is a
  *different domain* (card-transaction fraud, not vendor/invoice fraud).
  Do NOT use it to validate ledger/3-way-match logic directly. Instead, use
  it to demonstrate that the same Isolation Forest core generalizes across
  domains — frame this honestly in any docstrings/comments.
- **USASpending.gov + SEC AAER backtesting**: real public procurement data
  and real SEC enforcement-action outcomes, used as the strongest real-world
  validation source. Precision/recall/F1 should be computed against these
  where labels exist.

### The five features that must be built in from the start (not bolted on later)
1. **Reason codes ("why flagged")** — for every exception, a rule-based
   decomposition showing which sub-tests fired and by how much (e.g. Benford
   2nd-digit deviation: high; vendor-amount clustering: high; days-since-last
   -payment: unusual). Do NOT use SHAP or other model-explainability
   libraries — Isolation Forest is unsupervised and SHAP support is slow and
   fragile on modest hardware. This must be plain rule-based score
   decomposition logic.
2. **Live threshold/sensitivity control** — an interactive slider (in the UI)
   that re-queries the backend live and visibly changes precision/recall
   trade-offs and the ranked exception list in real time.
3. **Case-management status** — every exception has a status field:
   `unreviewed` / `confirmed` / `false_positive` / `needs_review`. A
   reviewer can change it via the UI; it's persisted in the database.
4. **Benchmark chart** — a literal rendered chart (not just a number) showing
   naive single-test Benford (or single baseline test) vs. the full ensemble,
   side by side, so the "we reduced false positives by X%" claim is visible
   live in the demo.
5. **Audit-trail log** — every detection run is logged: timestamp, dataset
   used, parameters/thresholds used, and who ran it. This is the direct,
   honest answer to security/compliance scope questions (see Section 6).

---

## 3. Explicit non-goals / scope boundaries

Do not build these — they are intentionally out of scope, and code should not
silently grow into them:
- No enterprise auth/RBAC. If a hosted demo needs login, a minimal
  session-based auth package is enough — not a full identity system.
- No encryption-at-rest, no PII handling pipeline. All data sources used are
  public (SEC EDGAR, USASpending, Kaggle, SEC AAER) — there is no PII, and
  this should be stated explicitly (e.g. in `docs/architecture.md` or a
  methodology page), not silently assumed.
- No generic "any ticker works" SEC EDGAR parser — curated company list only.
- No SHAP / model-explainability libraries for the ML models.
- No microservices, no Kubernetes, no cloud deployment — this is a
  laptop-run, Docker-Compose-packaged project. Any "how would this scale"
  answer should be a structural readiness argument (stateless functions
  behind an API layer), not actual infrastructure that gets built.

---

## 4. Hard constraints the generated code must respect

- **Cross-platform**: must run identically on macOS and Windows. Anything
  requiring a C compiler on Windows (e.g. the old `fuzzywuzzy` +
  `python-Levenshtein` combo) is disallowed — that's why `rapidfuzz` is used
  instead.
- **Agile/RAD delivery**: prefer the simplest dependency that does the job.
  Do not introduce heavyweight, rigid, or hard-to-configure frameworks.
  Team is time-constrained (hackathon timeline).
- **Modest hardware**: assume an 8GB RAM laptop, no GPU, no cloud compute.
  Streaming/chunked reads over full-file loads where data could be large;
  Isolation Forest and LOF are fine at these settings but should not be
  run on unbounded data without partitioning.
- **Team of 3, parallel work from day one**: the file structure below is
  deliberately split so three people can work concurrently without blocking
  each other. Respect the ownership boundaries in Section 7 — don't put
  backend logic in `frontend/`, don't put UI code in `backend/`, don't put
  detection logic in `data_infra/`.
- **No dead UI/backend**: every UI element must map 1:1 to a real, working
  backend endpoint. No "coming soon" buttons, no placeholder features left
  half-wired.

---

## 5. Tech stack (with reasoning — follow this exactly)

### Backend
- **Python 3.11** — pinned across the whole team for broadest pre-built wheel
  availability. A single `requirements.txt` generated from one clean
  `pip install` is the source of truth; nobody free-installs packages.
- **FastAPI** — all detection logic lives behind this, from day one. The
  frontend (Streamlit) is a thin client that only talks to FastAPI over
  HTTP; it never touches the database or detection logic directly. This is
  what makes a "how would you scale this" answer real instead of hand-wavy.
- **PostgreSQL** (via Docker Compose only — nobody installs Postgres
  locally) — primary data store: raw ingested data, computed features,
  exception/case records, and the audit-trail log. Chosen over DuckDB for
  real concurrent multi-user writes (needed for case-management: multiple
  reviewers updating exception statuses at once). Because it's a real
  client-server database, **it must only run inside Docker** — this keeps
  the "works identically on Mac and Windows" guarantee intact. The backend
  connects via `data_infra/db/connection.py`, never with ad-hoc connection
  strings scattered through the codebase.
- **SQLAlchemy / SQLModel** — ORM layer. Table shape is defined once in
  `data_infra/db/models.py` and imported by backend code — no raw SQL
  strings scattered through detection/adapter code.
- **Polars** (preferred) or Pandas — data wrangling before data hits
  Postgres or the ML models. Polars is multi-threaded by default and faster
  on the aggregation-heavy work Benford testing needs.
- **scikit-learn** — Isolation Forest, Local Outlier Factor. No GPU needed.
- **SciPy / NumPy** — Benford statistics (chi-square, MAD).
- **RapidFuzz** — fuzzy/duplicate invoice matching. Ships prebuilt wheels
  for both Mac and Windows (unlike `fuzzywuzzy` + `python-Levenshtein`,
  which needs a C compiler on Windows).
- **ProcessPoolExecutor / joblib** — partitions large datasets (by vendor or
  date range) and runs detection tests across partitions concurrently. This
  is the concrete, benchmarkable "real-world optimization" story — produces
  an actual "Nx faster across N cores" number for the pitch.
- **Pydantic** (via FastAPI) — request/response validation; also the
  input-validation security answer.
- **python-dotenv** — secrets stay in `.env` (never committed), even though
  there are no paid APIs involved.
- **pytest** — a smoke test per detection module at minimum. This is what
  prevents "it worked yesterday" from happening live during a demo.

### Frontend
- **Streamlit** — the entire demo UI. Fastest path to something an audience
  can watch being clicked through live.
- **Plotly** — all charts (Benford digit distributions, exception rankings,
  baseline-vs-ensemble benchmark chart, flagged-transactions timeline).
  Interactive, renders identically on both OSes.
- **Power BI is explicitly excluded** from the live product — it doesn't run
  natively on macOS. If someone wants to explore data in Power BI later,
  export CSV/Parquet; never make it a dependency of the running app or demo.

### Packaging
- **Docker Compose** with (at minimum) a `backend` service, a `frontend`
  service, and a `db` (Postgres) service. This is the actual fix for
  cross-platform version conflicts — Docker makes the host OS irrelevant.
  Everyone runs the same containers regardless of laptop.
- **Makefile** at the repo root with shortcuts (`make up`, `make seed`,
  `make reset-db`, `make test`) so nobody needs to remember multi-step
  Docker/DB commands under demo-prep pressure.

---

## 6. Security/compliance stance (must be reflected in code + docs, not skipped)

- All data sources are public (SEC EDGAR, USASpending, Kaggle, SEC AAER) —
  no PII, no data-protection burden. State this explicitly somewhere
  visible (e.g. `frontend/pages/7_About_Methodology.py` and
  `docs/architecture.md`).
- No hardcoded secrets — `.env` + `.gitignore`, loaded via
  `data_infra/security/env_validation.py`.
- Input validation on any uploaded file or ticker symbol, via
  `data_infra/security/input_sanitization.py`.
- A minimal audit-trail table (see Section 8, `audit_log` table) logging
  every detection run: timestamp, dataset, parameters, who ran it. This is
  the concrete, low-cost answer to "how do you handle compliance."
- Anything beyond this (encryption-at-rest, RBAC) is explicitly out of
  scope and should be described as a future-phase item in docs, not
  implemented.

---

## 7. File structure and per-file responsibility

Ownership is split three ways so three people can build in parallel without
blocking each other. Generate code respecting these boundaries — e.g. do not
put database connection logic inside `backend/`; it must live in
`data_infra/db/connection.py` and be imported.

```
audit-analytics-platform/
├── README.md
├── .env.example                 # POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB,
│                                 # POSTGRES_HOST, POSTGRES_PORT, DATABASE_URL
├── .gitignore
├── requirements.txt
├── docker-compose.yml           # backend + frontend + db (postgres:16-alpine) services
├── Dockerfile.backend
├── Dockerfile.frontend
├── pytest.ini
├── Makefile                     # make up / make seed / make reset-db / make test
│
├── docs/
│   ├── architecture.md          # shared-core/adapter explanation, scope boundaries
│   ├── api_reference.md         # FastAPI endpoint documentation
│   ├── data_sources.md          # what each dataset is, and its known limitations
│   ├── setup_guide.md           # "docker compose up" is the only setup step
│   └── demo_script.md           # walkthrough script for the live demo
│
├── backend/                     [OWNER: Person 1 — Backend / Detection Logic]
│   ├── __init__.py
│   ├── main.py                  # FastAPI app entrypoint, mounts all routers
│   ├── config.py                # settings, loads DATABASE_URL and other env vars
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes_ingest.py     # upload/select dataset endpoints
│   │   ├── routes_detect.py     # trigger a detection run; fetch ranked exceptions
│   │   ├── routes_cases.py      # update exception status (confirmed/false_positive/needs_review)
│   │   ├── routes_audit.py      # fetch audit-trail log entries
│   │   └── routes_benchmark.py  # naive-baseline vs ensemble comparison endpoint
│   │
│   ├── core/                    # the shared detection engine — the "one core" pitch
│   │   ├── __init__.py
│   │   ├── base.py              # abstract interface every detection test implements
│   │   ├── registry.py          # pluggable registration of tests, so adapters can
│   │   │                        #   register domain-specific tests against one core
│   │   ├── scorer.py            # combines individual test outputs into one ranked,
│   │   │                        #   scored exception list
│   │   ├── reason_codes.py      # decomposes each score into a human-readable
│   │   │                        #   "why flagged" explanation (rule-based, no SHAP)
│   │   └── parallel_runner.py   # ProcessPoolExecutor partition + merge logic;
│   │                            #   this is where the "Nx faster" benchmark comes from
│   │
│   ├── adapters/                # domain-specific reshaping + test registration only —
│   │   │                        #   no detection logic should live here, only glue
│   │   ├── __init__.py
│   │   ├── ledger/
│   │   │   ├── __init__.py
│   │   │   ├── adapter.py       # reshapes ledger/transaction data into core's format
│   │   │   ├── benford.py       # 1st/2nd/1st-2 digit tests, MAD, chi-square
│   │   │   ├── duplicate_detection.py  # rapidfuzz-based, with blocking logic
│   │   │   └── three_way_match.py      # rule-based PO-Invoice-GR logic (synthetic data)
│   │   └── financial_statement/
│   │       ├── __init__.py
│   │       ├── adapter.py       # reshapes SEC EDGAR company-facts data into core's format
│   │       ├── beneish.py       # Beneish M-Score
│   │       ├── altman.py        # Altman Z-Score
│   │       └── ratio_anomaly.py # Isolation Forest / LOF on financial ratios
│   │
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── isolation_forest.py  # thin wrapper/config around sklearn IsolationForest
│   │   ├── lof.py                # thin wrapper/config around sklearn LOF
│   │   └── model_utils.py        # shared preprocessing (scaling, feature prep)
│   │
│   ├── validation/
│   │   ├── __init__.py
│   │   ├── metrics.py            # precision/recall/F1 computation
│   │   ├── baseline_comparison.py # produces the naive-vs-ensemble numbers for the
│   │   │                          #   benchmark chart
│   │   └── cross_validation.py    # backtesting against Kaggle / USASpending / SEC AAER
│   │
│   ├── schemas/                  # Pydantic request/response contracts — this is the
│   │   │                         #   API shape the frontend codes against; define early,
│   │   │                         #   even as stubs, so frontend work isn't blocked
│   │   ├── __init__.py
│   │   ├── ingest_schemas.py
│   │   ├── detect_schemas.py
│   │   ├── case_schemas.py
│   │   └── audit_schemas.py
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_benford.py
│       ├── test_duplicate_detection.py
│       ├── test_three_way_match.py
│       ├── test_beneish.py
│       ├── test_altman.py
│       ├── test_scorer.py
│       ├── test_reason_codes.py
│       └── test_parallel_runner.py
│
├── frontend/                    [OWNER: Person 2 — Frontend / UI]
│   ├── __init__.py
│   ├── app.py                   # Streamlit entrypoint, page navigation
│   ├── api_client.py            # THE single seam to the backend — every HTTP call
│   │                            #   to FastAPI lives here and nowhere else. This file
│   │                            #   can be built against mocked/stub responses before
│   │                            #   real backend logic exists.
│   │
│   ├── pages/
│   │   ├── 1_Upload_Data.py
│   │   ├── 2_Ledger_Exceptions.py         # ranked table + reason codes + status buttons
│   │   ├── 3_Financial_Statement_Exceptions.py
│   │   ├── 4_Threshold_Explorer.py        # live sensitivity slider
│   │   ├── 5_Benchmark_Comparison.py      # naive-vs-ensemble chart
│   │   ├── 6_Audit_Log.py                 # view run history
│   │   └── 7_About_Methodology.py         # honest scope/limitations page — states
│   │                                      #   what's synthetic, what's out of scope,
│   │                                      #   and the "no PII" compliance answer
│   │
│   ├── components/
│   │   ├── __init__.py
│   │   ├── exception_table.py    # reusable sortable table with status buttons
│   │   ├── reason_code_badge.py  # renders "why flagged" per row
│   │   ├── threshold_slider.py
│   │   ├── charts.py             # Plotly chart builders (digit distribution,
│   │   │                         #   benchmark comparison, flagged-over-time timeline)
│   │   └── upload_widget.py
│   │
│   └── tests/
│       └── test_api_client.py    # tests against mocked HTTP responses; must run
│                                  #   without a live backend
│
├── data_infra/                  [OWNER: Person 3 — Data, Database & Infra]
│   ├── __init__.py
│   │
│   ├── db/
│   │   ├── schema.sql            # Postgres DDL — source of truth for table structure
│   │   ├── models.py             # SQLAlchemy/SQLModel ORM models, imported by backend;
│   │   │                         #   this is the contract — backend never writes raw
│   │   │                         #   table definitions itself
│   │   ├── migrations/
│   │   │   ├── 001_init.sql
│   │   │   ├── 002_audit_log.sql
│   │   │   └── 003_case_status.sql
│   │   └── connection.py         # SQLAlchemy engine + session factory, connection
│   │                              #   pooling, and a wait-for-Postgres-ready retry
│   │                              #   loop (Postgres isn't instantly ready after
│   │                              #   `docker compose up` — without this, first boot
│   │                              #   looks like a random crash)
│   │
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── sec_edgar_loader.py         # curated ~30-50 company list (see Section 2)
│   │   ├── usaspending_loader.py
│   │   ├── kaggle_fraud_loader.py
│   │   ├── sec_aaer_loader.py
│   │   └── synthetic_ledger_generator.py  # generates PO/Invoice/GR synthetic data
│   │                                       #   for the 3-way-match module
│   │                                       # NOTE: all loaders must bulk-load into
│   │                                       #   Postgres via COPY, not row-by-row INSERT
│   │
│   ├── datasets/
│   │   ├── raw/                  # gitignored
│   │   ├── processed/            # gitignored
│   │   └── sample/                # small committed samples so anyone can run the
│   │                              #   demo cold, without re-downloading data
│   │
│   ├── security/
│   │   ├── env_validation.py
│   │   └── input_sanitization.py  # validates uploaded files / ticker inputs
│   │
│   ├── scripts/
│   │   ├── seed_demo_data.py             # one command populates Postgres for the demo
│   │   ├── run_full_pipeline.sh
│   │   ├── benchmark_parallel_speedup.py  # generates the "Nx faster" number
│   │   └── reset_db.py                    # drop + recreate + reseed in one command —
│   │                                       #   the safety net for a messy DB mid-prep
│   │
│   └── tests/
│       ├── test_sec_edgar_loader.py
│       ├── test_schema_integrity.py
│       ├── test_seed_data.py
│       └── test_db_connection.py          # confirms pooling + retry logic works
│
└── .github/
    └── workflows/
        └── ci.yml               # spins up a real Postgres service container in CI
                                  #   (not mocked), runs backend/frontend/data_infra
                                  #   test suites on every push
```

---

## 8. Database schema (minimum required tables)

Define these in `data_infra/db/schema.sql` and mirror them in
`data_infra/db/models.py`:

- **`transactions`** (ledger domain raw + cleaned data): vendor, amount,
  invoice number, date, PO reference, GR reference, and any derived features
  used by detection tests.
- **`financial_statements`** (financial-statement domain): company/ticker,
  fiscal period, the line items needed for Beneish/Altman calculations, and
  derived ratios.
- **`exceptions`**: one row per flagged item, linking back to its source
  domain and record, with: ensemble score, individual sub-test scores,
  `status` (`unreviewed` / `confirmed` / `false_positive` / `needs_review`),
  reviewer, and timestamps.
- **`reason_codes`**: one-to-many with `exceptions` — each row is one
  sub-test's contribution/explanation for a given exception.
- **`audit_log`**: run history — timestamp, dataset used, parameters/
  thresholds, module(s) run, and who ran it.
- **`benchmark_results`**: stores naive-baseline vs ensemble comparison
  results (precision/recall/F1 for each), used to power the benchmark chart
  without recomputing it on every page load.

Indexes worth adding for demo-time responsiveness: on `vendor` and
`transaction_date` in `transactions`, and on `score` in `exceptions`
(the ranked table sorts by this constantly).

---

## 9. How the pieces connect (contracts between the three owners)

- **Backend ↔ Frontend**: `backend/schemas/` defines the API shapes;
  `frontend/api_client.py` consumes them. Agree these early — Person 1 can
  return dummy data matching the schema before real detection logic exists,
  so Person 2 is never blocked.
- **Backend ↔ Data/Infra**: `backend/` never opens its own database
  connection or writes raw SQL — it always imports
  `data_infra/db/connection.py` and uses models from
  `data_infra/db/models.py`. If backend needs a new column, that's a
  migration Person 3 adds, not something Person 1 edits directly in
  `schema.sql`.
- **Shared root files**: `docker-compose.yml` and `requirements.txt` are
  shared — any change to them should be flagged to the whole team, since a
  broken root file blocks everyone simultaneously.

---

## 10. Order of implementation (suggested build order for the agent)

1. `data_infra/db/schema.sql` + `models.py` + `connection.py` (with retry
   logic) + `docker-compose.yml` — get a running, connectable database
   first; nothing else can be tested without it.
2. `backend/schemas/` (stub contracts) so frontend can start in parallel.
3. `backend/core/base.py`, `registry.py`, `scorer.py` — the shared engine
   skeleton, before any specific test is implemented.
4. One vertical slice end-to-end: Benford ensemble
   (`adapters/ledger/benford.py`) → `core/scorer.py` →
   `api/routes_detect.py` → `frontend/pages/2_Ledger_Exceptions.py`. Get one
   full path working before building out every other test in parallel.
5. `core/reason_codes.py` and `validation/baseline_comparison.py` next —
   these are the two features with the highest demo impact.
6. Remaining detection tests (duplicate detection, 3-way match, Beneish,
   Altman, Isolation Forest/LOF) in parallel across the two adapters.
7. Case-management (`routes_cases.py`, status buttons), audit log
   (`routes_audit.py`, `6_Audit_Log.py`), threshold slider
   (`4_Threshold_Explorer.py`), and benchmark chart
   (`5_Benchmark_Comparison.py`) — wire these in once the underlying data
   they depend on is flowing.
8. `data_infra/scripts/seed_demo_data.py` and `reset_db.py` — build these
   early enough that the team can practice the demo repeatedly, not as an
   afterthought right before presenting.
