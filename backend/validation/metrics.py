"""Precision/recall/F1 against known labels. Deliberately just sklearn's
own implementation — no risk of a subtle reimplementation bug undermining
every reported number."""

from sklearn.metrics import precision_score, recall_score, f1_score


def compute_prf(y_true: list[int], y_pred: list[int]) -> dict:
    return {
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, zero_division=0), 4),
    }


def scores_to_labels(scores: dict[str, float], threshold: float) -> dict[str, int]:
    return {rid: int(score >= threshold) for rid, score in scores.items()}