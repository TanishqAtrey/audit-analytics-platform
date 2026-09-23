# backend/config.py
"""Centralized settings — everything comes from environment variables via
python-dotenv/pydantic. Every other backend module imports get_settings()
instead of instantiating Settings() itself."""

import json
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────
    database_url: str  # No default — must be provided via env
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800

    # ── Application ──────────────────────────────────────────────
    app_env: str = "development"
    api_prefix: str = "/api"
    cors_allow_origins: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8501"]
    default_currency: str = "INR"

    # ── Detection Defaults ───────────────────────────────────────
    default_benford_sensitivity: float = 0.5
    default_duplicate_similarity_threshold: float = 85.0
    default_isolation_forest_contamination: float = 0.05
    default_lof_contamination: float = 0.05
    default_three_way_match_tolerance_pct: float = 0.02
    max_parallel_workers: int = 4

    # ── Score Floors ─────────────────────────────────────────────
    min_flag_threshold: float = 0.30
    min_flag_threshold_fs: float = 0.20
    ml_combined_score_floor: float = 0.35
    min_ml_sample_size: int = 15
    min_benford_sample_size: int = 30

    # ── Upload Limits ────────────────────────────────────────────
    max_upload_size_mb: int = 50

    # ── Duplicate Detection ──────────────────────────────────────
    duplicate_amount_bucket_width: float = 50.0
    duplicate_date_proximity_days: int = 10
    duplicate_vendor_weight: float = 0.35
    duplicate_invoice_weight: float = 0.25
    duplicate_amount_weight: float = 0.30
    duplicate_date_weight: float = 0.10
    duplicate_vendor_sim_threshold: float = 85.0
    duplicate_invoice_sim_threshold: float = 80.0
    duplicate_amount_sim_threshold: float = 95.0
    duplicate_date_proximity_match_days: int = 2

    # ── Altman Z-Score ───────────────────────────────────────────
    altman_coeff_a: float = 1.2
    altman_coeff_b: float = 1.4
    altman_coeff_c: float = 3.3
    altman_coeff_d: float = 0.6
    altman_coeff_e: float = 1.0
    altman_safe_threshold: float = 2.99
    altman_grey_threshold: float = 1.81
    altman_distress_score: float = 0.85
    altman_grey_score: float = 0.50

    # ── Beneish M-Score ──────────────────────────────────────────
    beneish_threshold: float = -2.22
    beneish_intercept: float = -4.84
    beneish_coeff_dsri: float = 0.920
    beneish_coeff_gmi: float = 0.528
    beneish_coeff_aqi: float = 0.404
    beneish_coeff_sgi: float = 0.892
    beneish_coeff_depi: float = 0.115
    beneish_coeff_sgai: float = -0.172
    beneish_coeff_lvgi: float = -0.327
    beneish_coeff_tata: float = 4.679

    # ── Three-Way Match Rule Weights ─────────────────────────────
    rule_weight_missing_po: float = 0.9
    rule_weight_missing_gr: float = 0.7
    rule_weight_price_variance: float = 0.6
    rule_weight_quantity_variance: float = 0.6
    rule_weight_po_overbilled: float = 0.85

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cach