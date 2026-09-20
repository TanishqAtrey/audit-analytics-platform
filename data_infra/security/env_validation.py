# data_infra/security/env_validation.py
"""Validates environment configurations on start to avoid late runtime failures."""

import os
from typing import List


def validate_environment() -> List[str]:
    """Inspects environment values and returns a list of missing config warnings."""
    warnings = []
    
    required_keys = ["DATABASE_URL"]
    missing_required = [key for key in required_keys if not os.getenv(key)]
    if missing_required:
        raise RuntimeError(
            f"Missing mandatory environment variable(s): {', '.join(missing_required)}. "
            f"Application cannot start without these."
        )
            
    # Check default localhost fallback warnings
    db_url = os.getenv("DATABASE_URL", "")
    if "localhost" in db_url or "127.0.0.1" in db_url:
        if os.getenv("APP_ENV") == "production":
            warnings.append("Warning: Using local loopback address in database connection URL within production env.")
            
    return warnings
