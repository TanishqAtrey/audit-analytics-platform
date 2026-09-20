#!/usr/bin/env bash
# run_full_pipeline.sh — Runs the full data ingestion + detection pipeline
set -euo pipefail

echo "=== Audit Analytics Platform — Full Pipeline ==="
echo "Step 1: Reset database"
python -m data_infra.scripts.reset_db

echo "Step 2: Seed demo data"
python -m data_infra.scripts.seed_demo_data

echo "Step 3: Run backend validation"
python -m backend.run_full_validation

echo "=== Pipeline complete ==="
