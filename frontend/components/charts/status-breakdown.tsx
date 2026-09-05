'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface StatusBreakdownProps {
  data: {
    status: string;
    count: number;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  unreviewed: '#9ca3af',
  confirmed: '#ef4444',
  false_positive: '#22c55e',
  needs_review: '#f59e0b',
};

const formatStatus = (status: string) => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export function StatusBreakdown({ data }: StatusBreakdownProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-xl border border-gray-200 shadow-sm relative">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Exception Status Overview</h3>
      
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-8">
        <span className="text-3xl font-bold text-gray-900">{total}</span>
        <span className="text-sm text-gray-500">Total</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="count"
            nameKey="status"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#d1d5db'} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [value, 'Count']}
            labelFormatter={(label) => formatStatus(label as string)}
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span className="text-sm text-gray-700">{formatStatus(value)}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
