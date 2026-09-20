# data_infra/db/connection.py
"""SQLAlchemy database connection factory and lifecycle helpers.
Includes connection pooling, session generator, and postgres-readiness wait loop."""

import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from backend.config import get_settings

settings = get_settings()

# Database engine — dialect is determined by the DATABASE_URL scheme (e.g. postgresql+psycopg2://...)
engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session() -> Session:
    """Dependency helper to yield a scoped database session and close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_postgres_ready(max_retries: int = 15, delay: int = 3) -> None:
    """Blocks execution until PostgreSQL is ready to accept connections.
    Prevents fastapi container from crashing when starting simultaneously with DB."""
    for i in range(max_retries):
        try:
            # Try to connect and execute a simple query
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as e:
            print(f"Waiting for Postgres... (Retry {i+1}/{max_retries}) Error: {e}")
            time.sleep(delay)
    raise RuntimeError("Could not connect to PostgreSQL database after maximum retries.")
