import io
import os
import time
import logging

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger("data_infra.db.connection")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://audit_user:audit_pass@localhost:5432/audit_db",
)

# pool_pre_ping avoids handing out dead connections after Postgres restarts
# mid-demo; pool_size/max_overflow are deliberately modest — laptop project,
# not a production cluster.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db_session() -> Session:
    """FastAPI dependency: `db: Session = Depends(get_db_session)`."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_postgres_ready(max_attempts: int = 30, delay_seconds: float = 2.0) -> None:
    """
    Postgres isn't instantly ready right after `docker compose up` — the
    container process starts before the database accepts connections.
    Without this, the first request looks like a random crash instead of
    an obvious "still booting" state. Called from backend/main.py's
    startup event and from every data_infra script.
    """
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Postgres is ready (attempt %d/%d).", attempt, max_attempts)
            return
        except Exception as exc:  # noqa: BLE001 — broad on purpose; many
                                    # exception types can occur while Postgres boots
            logger.info("Postgres not ready (attempt %d/%d): %s. Retrying in %.1fs...",
                        attempt, max_attempts, exc, delay_seconds)
            time.sleep(delay_seconds)

    raise RuntimeError(
        f"Postgres did not become ready after {max_attempts} attempts "
        f"({max_attempts * delay_seconds:.0f}s). Check `docker compose logs db`."
    )


def bulk_copy_dataframe(df: pd.DataFrame, table_name: str, columns: list[str]) -> int:
    """
    Bulk-loads a dataframe into `table_name` via Postgres COPY. Every
    ingestion loader uses this instead of row-by-row INSERT — that's what
    makes ingesting tens of thousands of rows practical on a laptop.
    """
    if df.empty:
        return 0

    buffer = io.StringIO()
    df[columns].to_csv(buffer, index=False, header=False, na_rep="\\N")
    buffer.seek(0)

    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        cursor.copy_expert(
            f"COPY {table_name} ({', '.join(columns)}) FROM STDIN WITH CSV NULL '\\N'",
            buffer,
        )
        raw_conn.commit()
        return len(df)
    finally:
        raw_conn.close()