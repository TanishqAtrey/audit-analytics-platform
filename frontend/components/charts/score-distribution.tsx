'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

interface ScoreDistributionProps {
  data: {
    record_id: string;
    score: number;
    status: string;
  }[];
}

export function ScoreDistribution({ data }: ScoreDistributionProps) {
  // Take top 15 items max
  const sortedData = [...data].sort((a, b) => b.score - a.score).slice(0, 15);

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Exception Score Distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} />
          <YAxis 
            dataKey="record_id" 
            type="category" 
            tick={{ fontSize: 12 }} 
            width={80}
            tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ fill: '#f3f4f6' }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.score > 0.8 ? '#111827' : entry.score > 0.5 ? '#6b7280' : '#d1d5db'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
