# data_infra/scripts/reset_db.py
"""Database reset utility. Drops all existing tables and rebuilds them from schema.sql."""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from data_infra.db.connection import engine
from data_infra.db.models import Base

SCHEMA_SQL_PATH = os.path.join(os.path.dirname(__file__), '..', 'db', 'schema.sql')


def reset_database():
    print("Dropping all existing database tables...")
    Base.metadata.drop_all(bind=engine)
    print("Rebuilding database schema from schema.sql...")
    with open(SCHEMA_SQL_PATH, 'r') as f:
        schema_sql = f.read()
    with engine.begin() as conn:
        conn.execute(text(schema_sql))
    print("Database reset successfully.")


if __name__ == "__main__":
    reset_database()
