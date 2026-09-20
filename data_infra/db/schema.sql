-- Schema initialization for AuditIQ database
-- Sourced in docker container entry point or migration scripts

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    vendor VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    invoice_number VARCHAR(100),
    invoice_date DATE,
    po_reference VARCHAR(100),
    gr_reference VARCHAR(100),
    po_amount NUMERIC(18, 2),
    po_quantity NUMERIC(18, 4),
    gr_quantity NUMERIC(18, 4),
    currency VARCHAR(10) DEFAULT 'INR',
    source_dataset VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON transactions(vendor);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_date ON transactions(invoice_date);
CREATE INDEX IF NOT EXISTS idx_transactions_source_dataset ON transactions(source_dataset);

CREATE TABLE IF NOT EXISTS financial_statements (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    company VARCHAR(255) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    revenue NUMERIC(18, 2) NOT NULL,
    cogs NUMERIC(18, 2) NOT NULL,
    receivables NUMERIC(18, 2) NOT NULL,
    current_assets NUMERIC(18, 2) NOT NULL,
    ppe NUMERIC(18, 2) NOT NULL,
    total_assets NUMERIC(18, 2) NOT NULL,
    depreciation NUMERIC(18, 2) NOT NULL,
    sga_expense NUMERIC(18, 2) NOT NULL,
    current_liabilities NUMERIC(18, 2) NOT NULL,
    long_term_debt NUMERIC(18, 2) NOT NULL,
    net_income NUMERIC(18, 2) NOT NULL,
    cash_flow_ops NUMERIC(18, 2) NOT NULL,
    retained_earnings NUMERIC(18, 2) NOT NULL,
    market_value_equity NUMERIC(18, 2) NOT NULL,
    total_liabilities NUMERIC(18, 2) NOT NULL,
    is_aaer_fraud_case BOOLEAN DEFAULT FALSE,
    ebit NUMERIC(18, 2),
    altman_x1_wc_ta NUMERIC(10, 4),
    altman_x2_re_ta NUMERIC(10, 4),
    altman_x3_ebit_ta NUMERIC(10, 4),
    altman_x4_mve_tl NUMERIC(10, 4),
    altman_x5_sales_ta NUMERIC(10, 4),
    altman_z_score NUMERIC(10, 4),
    altman_zone VARCHAR(20),
    beneish_dsri NUMERIC(10, 4),
    beneish_gmi NUMERIC(10, 4),
    beneish_aqi NUMERIC(10, 4),
    beneish_sgi NUMERIC(10, 4),
    beneish_depi NUMERIC(10, 4),
    beneish_sgai NUMERIC(10, 4),
    beneish_lvgi NUMERIC(10, 4),
    beneish_tata NUMERIC(10, 4),
    beneish_m_score NUMERIC(10, 4),
    beneish_manipulator BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_financial_statements_ticker ON financial_statements(ticker);

CREATE TABLE IF NOT EXISTS exceptions (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(50) NOT NULL,
    source_record_id VARCHAR(100) NOT NULL,
    ensemble_score NUMERIC(5, 4) NOT NULL,
    individual_scores JSON,
    status VARCHAR(50) NOT NULL DEFAULT 'unreviewed',
    reviewer VARCHAR(100),
    reviewer_note VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exceptions_domain ON exceptions(domain);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_score ON exceptions(ensemble_score DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_source_record_id ON exceptions(source_record_id);

CREATE TABLE IF NOT EXISTS reason_codes (
    id SERIAL PRIMARY KEY,
    exception_id INTEGER NOT NULL REFERENCES exceptions(id) ON DELETE CASCADE,
    test_name VARCHAR(100) NOT NULL,
    contribution_score NUMERIC(5, 4) NOT NULL,
    explanation VARCHAR(500) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reason_codes_exception_id ON reason_codes(exception_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    run_timestamp TIMESTAMPTZ DEFAULT NOW(),
    dataset_used VARCHAR(255) NOT NULL,
    modules_run JSON NOT NULL,
    parameters JSON NOT NULL,
    run_by VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(run_timestamp DESC);

CREATE TABLE IF NOT EXISTS benchmark_results (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(50) NOT NULL,
    baseline_precision JSON NOT NULL,
    baseline_recall JSON NOT NULL,
    baseline_f1 JSON NOT NULL,
    ensemble_precision JSON NOT NULL,
    ensemble_recall JSON NOT NULL,
    ensemble_f1 JSON NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_results_domain ON benchmark_results(domain);
