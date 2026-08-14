# backend/ml/lof.py
import numpy as np
from sklearn.neighbors import LocalOutlierFactor
from backend.ml.model_utils import normalize_scores


def run_lof(X: np.ndarray, contamination: float = 0.05, n_neighbors: int = 20) -> np.ndarray:
    contamination = min(0.5, max(0.001, float(contamination)))
    n_neighbors = min(n_neighbors, max(2, len(X) - 1))
    model = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination)
    model.fit_predict(X)
    raw = -model.negative_outlier_factor_
    return normalize_scores(raw)