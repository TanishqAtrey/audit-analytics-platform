# test_schema_integrity.py — confirms schema.sql's tables match what
# models.py expects (their contract, per Section 9).
from sqlalchemy import inspect
from data_infra.db.connection import engine
from data_infra.db import models

EXPECTED_TABLES = {"transactions", "financial_statements", "exceptions",
                    "reason_codes", "audit_log", "benchmark_results"}

def test_all_expected_tables_exist():
    existing = set(inspect(engine).get_table_names())
    assert not (EXPECTED_TABLES - existing), f"Missing tables: {EXPECTED_TABLES - existing}"

def test_exceptions_has_case_management_columns():
    columns = {c["name"] for c in inspect(engine).get_columns("exceptions")}
    assert {"status", "reviewer", "reviewer_note", "updated_at"}.issubset(columns)

def test_reason_codes_foreign_key_to_exceptions():
    fks = inspect(engine).get_foreign_keys("reason_codes")
    assert any(fk["referred_table"] == "exceptions" for fk in fks)

def test_orm_models_match_table_names():
    assert models.Transaction.__tablename__ == "transactions"
    assert models.Exception.__tablename__ == "exceptions"
    assert models.BenchmarkResult.__tablename__ == "benchmark_results"