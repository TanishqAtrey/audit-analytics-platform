'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BenchmarkComparisonProps {
  baseline: { precision: number; recall: number; f1: number };
  ensemble: { precision: number; recall: number; f1: number };
  baselineLabel?: string;
}

export function BenchmarkComparison({ baseline, ensemble, baselineLabel = 'Baseline' }: BenchmarkComparisonProps) {
  const data = [
    {
      metric: 'Precision',
      baseline: baseline.precision,
      ensemble: ensemble.precision,
    },
    {
      metric: 'Recall',
      baseline: baseline.recall,
      ensemble: ensemble.recall,
    },
    {
      metric: 'F1 Score',
      baseline: baseline.f1,
      ensemble: ensemble.f1,
    },
  ];

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Baseline vs Ensemble Performance</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="metric" tick={{ fontSize: 14 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ fill: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="baseline" name={baselineLabel} fill="#9ca3af" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#6b7280', fontSize: 12 }} />
          <Bar dataKey="ensemble" name="Ensemble" fill="#2563eb" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#2563eb', fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
