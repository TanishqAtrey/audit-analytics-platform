# backend/main.py
"""FastAPI entrypoint. Only job: create the app, wire CORS, mount routers,
and on startup verify Postgres is reachable + make sure every test has
registered itself. No detection logic or DB session handling lives here."""

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.api import routes_ingest, routes_detect, routes_cases, routes_audit, routes_benchmark

# Importing (not calling) the adapters is what populates core.registry —
# each test module self-registers via @register_test at import time.
from backend.adapters.ledger import adapter as _ledger_adapter          # noqa: F401
from backend.adapters.financial_statement import adapter as _fs_adapter  # noqa: F401

import os
from sqlalchemy import text
from data_infra.db.connection import wait_for_postgres_ready, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Postgres isn't instantly ready after `docker compose up` — this
    # blocks with backoff until it is, so the container fails loudly
    # instead of every request silently 500-ing on first boot.
    wait_for_postgres_ready()
    try:
        migration_file = os.path.join(os.path.dirname(__file__), "..", "data_infra", "db", "migrations", "004_financial_statement_ratios.sql")
        if os.path.exists(migration_file):
            with open(migration_file, "r") as f:
                sql_content = f.read()
            with engine.connect() as conn:
                for statement in sql_content.split(";"):
                    stmt = statement.strip()
                    if stmt:
                        conn.execute(text(stmt))
                conn.commit()
            logger.info("Schema migration 004 applied successfully.")
    except Exception as e:
        logger.warning(f"Schema migration warning: {e}")
    yield


app = FastAPI(title="Audit Analytics Platform API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_allow_origins,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(routes_ingest.router, prefix=f"{settings.api_prefix}/ingest", tags=["ingest"])
app.include_router(routes_detect.router, prefix=f"{settings.api_prefix}/detect", tags=["detect"])
app.include_router(routes_cases.router, prefix=f"{settings.api_prefix}/cases", tags=["cases"])
app.include_router(routes_audit.router, prefix=f"{settings.api_prefix}/audit", tags=["audit"])
app.include_router(routes_benchmark.router, prefix=f"{settings.api_prefix}/benchmark", tags=["benchmark"])


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "env": settings.app_env}