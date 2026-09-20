.PHONY: up down restart build seed reset-db test lint shell-backend shell-frontend logs

## ── Main lifecycle ─────────────────────────────────────────────────────────

up:          ## Start all services (detached)
	docker compose up -d --build

down:        ## Stop all services
	docker compose down

restart:     ## Restart all services (no rebuild)
	docker compose restart

rebuild:     ## Force-rebuild all images and start
	docker compose up -d --build --force-recreate

## ── Database ───────────────────────────────────────────────────────────────

seed:        ## Seed demo data into Postgres (runs seed_demo_data.py)
	docker compose exec backend python data_infra/scripts/seed_demo_data.py

reset-db:    ## Drop + recreate + reseed database (safe to run mid-demo)
	docker compose exec backend python data_infra/scripts/reset_db.py

## ── Testing ────────────────────────────────────────────────────────────────

test:        ## Run the full test suite
	docker compose exec backend pytest -v

test-backend:
	docker compose exec backend pytest backend/tests/ -v

test-frontend:
	docker compose exec frontend npm run lint || true

test-data:
	docker compose exec backend pytest data_infra/tests/ -v

## ── Dev utilities ──────────────────────────────────────────────────────────

logs:        ## Tail logs from all services
	docker compose logs -f

shell-backend:
	docker compose exec backend bash

shell-frontend:
	docker compose exec frontend sh

shell-db:
	docker compose exec db psql -U auditiq -d auditiq_db

## ── Benchmark ──────────────────────────────────────────────────────────────

benchmark:   ## Run parallelism benchmark (generates Nx-faster number)
	docker compose exec backend python data_infra/scripts/benchmark_parallel_speedup.py

## ── Quick start (no Docker) ────────────────────────────────────────────────

install:     ## Install Python and Node dependencies (local dev without Docker)
	pip install -r requirements.txt
	cd dashboard && npm install

run-backend-local:   ## Run FastAPI backend locally on port 8002
	python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload

run-frontend-local:  ## Run React dashboard locally on port 3002
	cd dashboard && npm run dev

seed-local:          ## Seed local PostgreSQL database
	python3 data_infra/scripts/seed_demo_data.py

help:        ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
