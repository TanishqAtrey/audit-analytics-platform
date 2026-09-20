-- 003_case_status.sql
-- Adds reviewer and status tracking columns to the exceptions table.
-- NOTE: These columns are now included in the initial schema.sql.
-- This migration exists for environments that bootstrapped before case management was added.

ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS reviewer VARCHAR(100);
ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS reviewer_note VARCHAR(1000);
ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
