# backend/ml/lof.py
import numpy as np
from sklearn.neighbors import LocalOutlierFactor
from backend.ml.model_utils import normalize_scores


def run_lof(X: np.ndarray, contamination: float = 0.05, n_neighbors: int = 20) -> np.ndarray:
    contamination = min(0.5, max(0.001, float(contamination)))
    n_neighbors = min(n_neighbors, max(2, len(X) - 1))
    
    # For large datasets (e.g. > 10,000 rows), use novelty=True on a subsample for lightning-fast O(N) scoring
    if len(X) > 10000:
        rng = np.random.default_rng(42)
        sample_size = min(10000, len(X))
        idx = rng.choice(len(X), size=sample_size, replace=False)
        X_sub = X[idx]
        model = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination, novelty=True, n_jobs=-1)
        model.fit(X_sub)
        raw = -model.decision_function(X)
    else:
        model = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination, n_jobs=-1)
        model.fit_predict(X)
        raw = -model.negative_outlier_factor_
        
    return normalize_scores(raw)