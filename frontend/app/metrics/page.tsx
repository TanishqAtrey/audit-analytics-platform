'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { getBenchmark, runBenchmark, BenchmarkResult } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FilterChips } from '@/components/ui/filter-chips';
import { LoadButton } from '@/components/ui/load-button';
import { BenchmarkComparison } from '@/components/charts/benchmark-comparison';

export default function MetricsPage() {
  const [domain, setDomain] = useState('ledger');
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBenchmark(domain);
  }, [domain]);

  const fetchBenchmark = async (d: string) => {
    try {
      const data = await getBenchmark(d);
      setBenchmark(data);
    } catch (error) {
      setBenchmark(null);
    }
  };

  const handleRunBenchmark = async () => {
    try {
      setLoading(true);
      const datasetId = domain === 'ledger' ? (localStorage.getItem('ledger_dataset_id') || undefined) : undefined;
      const data = await runBenchmark(domain, datasetId);
      setBenchmark(data);
    } catch (error) {
      console.error('Benchmark failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-white min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="text-gray-500">Compare ensemble model performance against baseline heuristics.</p>
        </div>
        <LoadButton onClick={handleRunBenchmark} loading={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm">
          Run Benchmark
        </LoadButton>
      </div>

      <div className="flex space-x-2">
        <FilterChips 
          options={[
            { label: 'Ledger', value: 'ledger' },
            { label: 'Financial Statement', value: 'financial_statement' }
          ]}
          value={domain}
          onChange={setDomain}
        />
      </div>

      {!benchmark ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-gray-200">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No benchmark data</h3>
          <p className="text-gray-500 mb-6">Run a benchmark to evaluate model performance for the {domain} domain.</p>
          <LoadButton onClick={handleRunBenchmark} loading={loading} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors">
            Run Benchmark Now
          </LoadButton>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricComparisonCard title="Precision" baseline={benchmark.baseline.precision} ensemble={benchmark.ensemble.precision} />
            <MetricComparisonCard title="Recall" baseline={benchmark.baseline.recall} ensemble={benchmark.ensemble.recall} />
            <MetricComparisonCard title="F1 Score" baseline={benchmark.baseline.f1} ensemble={benchmark.ensemble.f1} />
          </div>

          <BenchmarkComparison baseline={benchmark.baseline} ensemble={benchmark.ensemble} />

          <div className="bg-slate-50 border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
            <p>Last computed: {new Date(benchmark.computed_at).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricComparisonCard({ title, baseline, ensemble }: { title: string, baseline: number, ensemble: number }) {
  const delta = ensemble - baseline;
  const isPositive = delta >= 0;
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Baseline</p>
            <p className="text-2xl font-bold text-gray-400">{(baseline * 100).toFixed(1)}%</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300 mb-1" />
          <div className="text-right">
            <p className="text-sm font-medium text-blue-600 mb-1">Ensemble</p>
            <p className="text-3xl font-bold text-gray-900">{(ensemble * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Improvement</span>
          <div className={cn("flex items-center space-x-1 px-2.5 py-1 rounded-full text-sm font-medium", isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isPositive ? '+' : ''}{(delta * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
