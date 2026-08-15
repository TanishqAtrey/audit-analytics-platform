#!/usr/bin/env bash
# End-to-end: validate env -> bring up containers -> wait for Postgres ->
# apply migrations -> seed demo data. One command for a fresh checkout.
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

echo "==> Validating environment..."
python -m data_infra.security.env_validation

echo "==> Starting Docker Compose services..."
docker compose up -d

echo "==> Waiting for Postgres and seeding demo data..."
python -m data_infra.scripts.seed_demo_data

echo "==> Done. Backend: http://localhost:8000/health   Frontend: http://localhost:8501"