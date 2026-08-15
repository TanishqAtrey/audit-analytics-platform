-- Adds case-management columns to exceptions — must-build feature #3
-- (Section 2): every flagged item gets a reviewable status.

ALTER TABLE exceptions
    ADD COLUMN status TEXT NOT NULL DEFAULT 'unreviewed'
        CHECK (status IN ('unreviewed', 'confirmed', 'false_positive', 'needs_review')),
    ADD COLUMN reviewer TEXT,
    ADD COLUMN reviewer_note TEXT,
    ADD COLUMN updated_at TIMESTAMPTZ;

CREATE INDEX idx_exceptions_status ON exceptions (status);