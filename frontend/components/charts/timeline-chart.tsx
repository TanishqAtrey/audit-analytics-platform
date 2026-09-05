'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TimelineChartProps {
  data: {
    date: string;
    count: number;
    avgScore: number;
  }[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Detection Activity Timeline</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }} 
            axisLine={false} 
            tickLine={false} 
            padding={{ left: 20, right: 20 }}
          />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12 }} 
            axisLine={false} 
            tickLine={false} 
            orientation="left"
            label={{ value: 'Exception Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 } }}
          />
          <YAxis 
            yAxisId="right" 
            tick={{ fontSize: 12 }} 
            axisLine={false} 
            tickLine={false} 
            orientation="right" 
            domain={[0, 1]}
            label={{ value: 'Average Score', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#2563eb', fontSize: 12 } }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ fill: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="left" dataKey="count" name="Count" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={40} />
          <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Avg Score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
