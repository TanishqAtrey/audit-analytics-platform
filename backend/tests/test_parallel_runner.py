# backend/tests/test_parallel_runner.py
import pandas as pd
from backend.core.base import DetectionTest, TestResult
from backend.core.parallel_runner import run_test_parallel

class _EchoTest(DetectionTest):
    name, domain = "echo", "ledger"
    def run(self, df, config):
        return [TestResult(record_id=rid, score=1.0, detail={}) for rid in df["record_id"]]

def test_small_dataframe_skips_partitioning():
    df = pd.DataFrame({"record_id": ["a", "b"], "vendor": ["X", "Y"]})
    assert len(run_test_parallel(_EchoTest(), df, {}, partition_column="vendor")) == 2

def test_partitioning_preserves_every_record():
    df = pd.DataFrame({"record_id": [f"r{i}" for i in range(6000)],
                        "vendor": ["A"] * 2000 + ["B"] * 2000 + ["C"] * 2000})
    assert len(run_test_parallel(_EchoTest(), df, {}, partition_column="vendor")) == 6000