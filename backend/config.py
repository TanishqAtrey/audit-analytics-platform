# backend/config.py
"""Centralized settings — everything comes from environment variables via
python-dotenv/pydantic. Every other backend module imports get_settings()
instead of instantiating Settings() itself."""

import json
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

