"""One command to populate Postgres for the demo. Usage:
python -m data_infra.scripts.seed_demo_data"""

import sys
import logging

from data_infra.security.env_validation import validate_env
from data_infra.db.connection import wait_for_postgres_ready
from data_infra.ingestion.sec_edgar_loader import load_and_persist_curated_companies
from data_infra.ingestion.sec_aaer_loader import sync_aaer_flags_to_db
from data_infra.ingestion.synthetic_ledger_generator import generate_and_persist_synthetic_ledger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_demo_data")


def main() -> None:
    validate_env()
    wait_for_postgres_ready()

    logger.info("Loading curated SEC EDGAR companies...")
    n_fs = load_and_persist_curated_companies()
    logger.info("Loaded %d financial_statements rows.", n_fs)

    logger.info("Syncing AAER fraud-case flags...")
    logger.info("Flagged %d rows as AAER cases.", sync_aaer_flags_to_db())

    logger.info("Generating synthetic 3-way-match ledger data...")
    dataset_id, n_txn = generate_and_persist_synthetic_ledger(n_rows=5000)
    logger.info("Generated %d transactions under dataset_id=%s", n_txn, dataset_id)
    logger.info("Seed complete. Demo dataset_id for the ledger domain: %s", dataset_id)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("Seeding failed.")
        sys.exit(1)