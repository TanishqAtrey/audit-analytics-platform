-- 002_audit_log.sql
-- Adds the audit_log table for tracking detection runs.
-- NOTE: This table is now included in schema.sql (initial schema).
-- This migration exists for environments that bootstrapped before audit_log was added.

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    run_timestamp TIMESTAMPTZ DEFAULT NOW(),
    dataset_used VARCHAR(255) NOT NULL,
    modules_run JSON NOT NULL,
    parameters JSON NOT NULL,
    run_by VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(run_timestamp DESC);
