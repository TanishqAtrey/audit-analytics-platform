# backend/config.py
"""Centralized settings — everything comes from environment variables via
python-dotenv/pydantic. Every other backend module imports get_settings()
instead of instantiating Settings() itself."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://audit_user:audit_pass@localhost:5432/audit_db"
    app_env: str = "development"
    api_prefix: str = "/api"
    cors_allow_origins: list[str] = ["http://localhost:8501"]  # Streamlit default port

    default_benford_significance: float = 0.05
    default_duplicate_similarity_threshold: float = 85.0
    default_isolation_forest_contamination: float = 0.05
    default_lof_contamination: float = 0.05
    max_parallel_workers: int = 4  # modest-hardware friendly cap

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()