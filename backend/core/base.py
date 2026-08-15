from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import pandas as pd


@dataclass
class TestResult:
    """One row of output from a single sub-test, before ensembling."""
    record_id: str            # must match a row identifier in the input dataframe
    score: float               # normalized 0-1, higher = more suspicious
    detail: dict = field(default_factory=dict)  # raw numbers reason_codes.py
                                                   # turns into English


class DetectionTest(ABC):
    """Subclassed by every concrete test (Benford, duplicate detection,
    3-way match, Beneish, Altman, Isolation Forest, LOF, ...)."""

    name: str = "unnamed_test"          # short machine key, used everywhere
    domain: str = "ledger"              # or "financial_statement"

    @abstractmethod
    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        """
        df: the domain-reshaped dataframe produced by that domain's adapter
            (already has whatever columns this test needs — guaranteeing
            that contract is the adapter's job, not this method's).
        config: the relevant slice of ThresholdConfig for this test, as a
            plain dict (keeps core/ free of a backend.schemas import and
            avoids a circular dependency).

        Returns one TestResult per flagged-or-scored record. A test can
        score every record or only ones above its own internal noise
        floor — scorer.py treats "no TestResult from this test for this
        record" as a score of 0 for that test.
        """
        raise NotImplementedError