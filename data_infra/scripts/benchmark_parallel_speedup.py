"""Usage: python -m data_infra.scripts.benchmark_parallel_speedup"""

import time
import multiprocessing

from data_infra.ingestion.synthetic_ledger_generator import generate_synthetic_ledger
from backend.adapters.ledger.duplicate_detection import DuplicateDetectionTest
from backend.core.parallel_runner import run_test_parallel


def main(n_rows: int = 60000) -> None:
    df = generate_synthetic_ledger(n_rows=n_rows)
    test = DuplicateDetectionTest()
    config = {"duplicate_similarity_threshold": 85.0}

    print(f"Rows: {n_rows} | CPU cores available: {multiprocessing.cpu_count()}")

    start = time.perf_counter()
    single = test.run(df, config)
    single_time = time.perf_counter() - start
    print(f"Single-process: {single_time:.2f}s, {len(single)} flagged")

    start = time.perf_counter()
    parallel = run_test_parallel(test, df, config, partition_column="vendor")
    parallel_time = time.perf_counter() - start
    print(f"Parallel:       {parallel_time:.2f}s, {len(parallel)} flagged")

    speedup = single_time / parallel_time if parallel_time > 0 else float("inf")
    print(f"\nSpeedup: {speedup:.2f}x across {multiprocessing.cpu_count()} cores")


if __name__ == "__main__":
    main()