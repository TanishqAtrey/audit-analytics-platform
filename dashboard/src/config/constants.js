// Dashboard configuration constants — single source of truth
// All values that were previously hardcoded across components

export const API_CONFIG = {
  TIMEOUT_MS: 180_000,
  HEALTH_CHECK_TIMEOUT_MS: 3_000,
};

export const LAYOUT = {
  SIDEBAR_WIDTH: 260,
};

export const THRESHOLDS = {
  // Beneish M-Score: above this = likely earnings manipulator
  M_SCORE_MANIPULATION: -2.22,
  // Altman Z-Score zones
  Z_SCORE_SAFE: 2.99,
  Z_SCORE_GREY: 1.81,
  // Risk severity — ensemble score color bands
  CRITICAL_RISK: 0.80,
  HIGH_RISK: 0.60,
  MEDIUM_RISK: 0.50,
};

export const DEFAULTS = {
  CURRENCY: 'INR',
  DETECTION_THRESHOLD: 0.5,
  MIN_EXCEPTION_SCORE: 0.0,
  FS_DETECTION_THRESHOLD: 0.25,
  DUPLICATE_SIMILARITY_THRESHOLD: 85.0,
  ISOLATION_FOREST_CONTAMINATION: 0.05,
  LOF_CONTAMINATION: 0.05,
  THREE_WAY_MATCH_TOLERANCE_PCT: 0.02,
};

export const APP_META = {
  VERSION: '0.1.0',
  TITLE: 'AuditIQ Platform',
};
