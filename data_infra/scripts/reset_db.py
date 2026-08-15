"""Drop + recreate + reseed in one command — the safety net for a messy
database mid-demo-prep. Usage: python -m data_infra.scripts.reset_db"""

import logging
from pathlib import Path

from sqlalchemy import text

from data_infra.db.connection import engine, wait_for_postgres_ready
from data_infra.db.models import Base
from data_infra.scripts.seed_demo_data import main as seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reset_db")
SCHEMA_SQL_PATH = Path(__file__).resolve().parents[1] / "db" / "schema.sql"


def reset_and_reseed() -> None:
    wait_for_postgres_ready()

    logger.info("Dropping all known tables...")
    Base.metadata.drop_all(bind=engine)

    logger.info("Re-applying schema.sql...")
    raw_sql = SCHEMA_SQL_PATH.read_text()
    with engine.begin() as conn:
        # schema.sql contains multiple statements — execute each one separately
        for statement in raw_sql.split(";"):
            cleaned = statement.strip()
            if cleaned:
                conn.execute(text(cleaned))

    logger.info("Reseeding demo data...")
    seed_demo_data()
    logger.info("Reset complete.")


if __name__ == "__main__":
    reset_and_reseed()