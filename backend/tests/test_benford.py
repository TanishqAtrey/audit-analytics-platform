# backend/tests/test_benford.py
import numpy as np
import pandas as pd
from backend.adapters.ledger.benford import BenfordEnsembleTest


def _fake_vendor_df(n, benford_conformant=True, vendor="Acme Corp"):
    rng = np.random.default_rng(42)
    if benford_conformant:
        amounts = np.exp(rng.uniform(np.log(1), np.log(100000), size=n))
    else:
        amounts = rng.choice([950.0, 950.0, 990.0, 999.0], size=n)
    return pd.DataFrame({"record_id": [f"r{i}" for i in range(n)], "vendor": vendor, "amount": amounts})


def test_conformant_vendor_scores_low():
    results = BenfordEnsembleTest().run(_fake_vendor_df(200, True), {"benford_sensitivity": 0.5})
    if results:
        assert np.mean([r.score for r in results]) < 0.5


def test_nonconformant_vendor_is_flagged():
    results = BenfordEnsembleTest().run(_fake_vendor_df(200, False), {"benford_sensitivity": 0.8})
    assert len(results) > 0


def test_small_sample_is_skipped():
    results = BenfordEnsembleTest().run(_fake_vendor_df(5, False), {"benford_sensitivity": 0.5})
    assert results == []