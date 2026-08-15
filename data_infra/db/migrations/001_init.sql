-- Initial schema: core detection-domain tables. Case-management columns
-- land later in 003_case_status.sql, once the pipeline actually produces
-- exceptions to manage — mirrors the build order in Section 10.

CREATE TABLE transactions (
    id               BIGSERIAL PRIMARY KEY,
    vendor           TEXT NOT NULL,
    amount           NUMERIC(14, 2) NOT NULL,
    invoice_number   TEXT,
    invoice_date     DATE,
    po_reference     TEXT,
    po_amount        NUMERIC(14, 2),
    po_quantity      NUMERIC(12, 2),
    gr_reference     TEXT,
    gr_quantity      NUMERIC(12, 2),
    source_dataset   TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_vendor         ON transactions (vendor);
CREATE INDEX idx_transactions_invoice_date   ON transactions (invoice_date);
CREATE INDEX idx_transactions_source_dataset ON transactions (source_dataset);
CREATE INDEX idx_transactions_po_reference   ON transactions (po_reference);

CREATE TABLE financial_statements (
    id                    BIGSERIAL PRIMARY KEY,
    ticker                TEXT NOT NULL,
    company_name          TEXT,
    sector                TEXT,
    fiscal_year           INTEGER NOT NULL,
    fiscal_period         TEXT NOT NULL DEFAULT 'FY',
    is_aaer_fraud_case    BOOLEAN NOT NULL DEFAULT FALSE,
    revenue               NUMERIC(18, 2),
    cogs                  NUMERIC(18, 2),
    receivables           NUMERIC(18, 2),
    current_assets        NUMERIC(18, 2),
    ppe                   NUMERIC(18, 2),
    total_assets          NUMERIC(18, 2),
    depreciation          NUMERIC(18, 2),
    sga_expense            NUMERIC(18, 2),
    current_liabilities     NUMERIC(18, 2),
    long_term_debt           NUMERIC(18, 2),
    net_income                NUMERIC(18, 2),
    cash_flow_ops              NUMERIC(18, 2),
    retained_earnings           NUMERIC(18, 2),
    market_value_equity          NUMERIC(18, 2),
    total_liabilities             NUMERIC(18, 2),
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ticker, fiscal_year, fiscal_period)
);

CREATE INDEX idx_financial_statements_ticker ON financial_statements (ticker);

CREATE TABLE exceptions (
    id                  BIGSERIAL PRIMARY KEY,
    domain              TEXT NOT NULL CHECK (domain IN ('ledger', 'financial_statement')),
    source_record_id    TEXT NOT NULL,
    ensemble_score       NUMERIC(5, 4) NOT NULL,
    individual_scores    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exceptions_score  ON exceptions (ensemble_score DESC);
CREATE INDEX idx_exceptions_domain ON exceptions (domain);

CREATE TABLE reason_codes (
    id                    BIGSERIAL PRIMARY KEY,
    exception_id          BIGINT NOT NULL REFERENCES exceptions (id) ON DELETE CASCADE,
    test_name             TEXT NOT NULL,
    contribution_score    NUMERIC(5, 4) NOT NULL,
    explanation           TEXT NOT NULL
);

CREATE INDEX idx_reason_codes_exception_id ON reason_codes (exception_id);

CREATE TABLE benchmark_results (
    id                    BIGSERIAL PRIMARY KEY,
    domain                TEXT NOT NULL CHECK (domain IN ('ledger', 'financial_statement')),
    baseline_precision    NUMERIC(5, 4) NOT NULL,
    baseline_recall       NUMERIC(5, 4) NOT NULL,
    baseline_f1           NUMERIC(5, 4) NOT NULL,
    ensemble_precision    NUMERIC(5, 4) NOT NULL,
    ensemble_recall       NUMERIC(5, 4) NOT NULL,
    ensemble_f1           NUMERIC(5, 4) NOT NULL,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_benchmark_results_domain ON benchmark_results (domain, computed_at DESC);