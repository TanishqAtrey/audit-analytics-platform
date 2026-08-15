# backend/ml/isolation_forest.py
import numpy as np
from sklearn.ensemble import IsolationForest
from backend.ml.model_utils import normalize_scores


def run_isolation_forest(X: np.ndarray, contamination: float = 0.05, random_state: int = 42) -> np.ndarray:
    contamination = min(0.5, max(0.001, float(contamination)))
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X)
    raw = -model.decision_function(X)
    return normalize_scores(raw)