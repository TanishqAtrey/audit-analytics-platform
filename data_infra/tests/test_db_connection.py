# data_infra/tests/test_db_connection.py
"""Smoke test for database connection pooling and retry logic."""
import pytest


def test_connection_module_imports():
    """Verify the connection module can be imported without errors."""
    from data_infra.db import connection
    assert hasattr(connection, 'engine')
    assert hasattr(connection, 'SessionLocal')
    assert hasattr(connection, 'get_db_session')
    assert hasattr(connection, 'wait_for_postgres_ready')
