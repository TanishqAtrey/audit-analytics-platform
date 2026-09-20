# data_infra/scripts/benchmark_parallel_speedup.py
"""Benchmarks parallel vs. sequential detection to produce the 'Nx faster' number."""

import sys
import os
import time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))


def main():
    print("Parallel speedup benchmark — requires synthetic data.")
    print("TODO: Generate synthetic ledger, run detection sequentially vs. parallel,")
    print("      and report the speedup factor.")


if __name__ == "__main__":
    main()
