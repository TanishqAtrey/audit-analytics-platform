# backend/ml/model_utils.py
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


def build_feature_matrix(df: pd.DataFrame, feature_cols: list[str], id_col: str) -> tuple[np.ndarray, list[str]]:
    features = df[feature_cols].astype(float).fillna(0.0)
    scaler = StandardScaler()
    X = scaler.fit_transform(features)
    return X, df[id_col].astype(str).tolist()


def normalize_scores(raw_scores: np.ndarray) -> np.ndarray:
    lo, hi = raw_scores.min(), raw_scores.max()
    if hi - lo < 1e-9:
        return np.zeros_like(raw_scores)
    return (raw_scores - lo) / (hi - lo)