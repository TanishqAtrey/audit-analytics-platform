# backend/core/parallel_runner.py
from concurrent.futures import ProcessPoolExecutor
import pandas as pd

from backend.core.base import DetectionTest, TestResult
from backend.config import get_settings


def _partition_by_column(df: pd.DataFrame, column: str, n_partitions: int) -> list[pd.DataFrame]:
    """Bin-packs whole groups (by `column`) into n_partitions roughly-equal
    chunks, so a single vendor's rows never split across workers."""
    groups = [g for _, g in df.groupby(column)]
    groups.sort(key=len, reverse=True)
    buckets: list[list[pd.DataFrame]] = [[] for _ in range(n_partitions)]
    bucket_sizes = [0] * n_partitions
    for g in groups:
        i = bucket_sizes.index(min(bucket_sizes))
        buckets[i].append(g)
        bucket_sizes[i] += len(g)
    return [pd.concat(b, ignore_index=True) for b in buckets if b]


def _run_single_test_on_partition(args: tuple[DetectionTest, pd.DataFrame, dict]) -> list[TestResult]:
    test, partition, config = args
    return test.run(partition, config)


def run_test_parallel(
    test: DetectionTest,
    df: pd.DataFrame,
    config: dict,
    partition_column: str,
) -> list[TestResult]:
    """Drop-in replacement for `test.run(df, config)` that partitions
    first. Falls back to single-process below 5000 rows — process-pool
    startup cost isn't worth it on small dataframes."""
    settings = get_settings()
    if len(df) < 5000 or partition_column not in df.columns:
        return test.run(df, config)

    n_workers = min(settings.max_parallel_workers, df[partition_column].nunique())
    partitions = _partition_by_column(df, partition_column, n_workers)

    merged: list[TestResult] = []
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        results_per_partition = pool.map(
            _run_single_test_on_partition,
            [(test, p, config) for p in partitions],
        )
        for r in results_per_partition:
            merged.extend(r)

    return merged