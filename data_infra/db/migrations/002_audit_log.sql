-- Adds the audit trail — the concrete answer to "how do you handle
-- compliance" (Section 6). Every detection run writes exactly one row.

CREATE TABLE audit_log (
    id                BIGSERIAL PRIMARY KEY,
    run_timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
    dataset_used       TEXT NOT NULL,
    modules_run        JSONB NOT NULL DEFAULT '[]'::jsonb,
    parameters         JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_by             TEXT NOT NULL
);

CREATE INDEX idx_audit_log_run_timestamp ON audit_log (run_timestamp DESC);