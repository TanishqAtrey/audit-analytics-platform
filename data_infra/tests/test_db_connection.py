# test_db_connection.py — confirms pooling + retry logic work, which is
# what prevents a first-boot "random crash" from being a mystery.
import pytest
from sqlalchemy import text
from data_infra.db.connection import engine, get_db_session, wait_for_postgres_ready

def test_engine_connects():
    wait_for_postgres_ready(max_attempts=5, delay_seconds=1.0)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1

def test_get_db_session_yields_usable_session():
    gen = get_db_session()
    db = next(gen)
    assert db.execute(text("SELECT 1")).scalar() == 1
    gen.close()

def test_wait_for_postgres_ready_raises_on_bad_host(monkeypatch):
    from sqlalchemy import create_engine
    bad_engine = create_engine("postgresql+psycopg2://baduser:badpass@localhost:59999/nope")
    monkeypatch.setattr("data_infra.db.connection.engine", bad_engine)
    with pytest.raises(RuntimeError):
        wait_for_postgres_ready(max_attempts=2, delay_seconds=0.1)