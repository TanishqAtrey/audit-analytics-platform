'use client';

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TestContributionsProps {
  data: {
    record_id: string;
    contributions: {
      test_name: string;
      score: number;
    }[];
  }[];
}

const COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#2563eb'];

export function TestContributions({ data }: TestContributionsProps) {
  // Take top 10 items
  const displayData = data.slice(0, 10);

  // Transform data for recharts stacked bar
  const transformedData = displayData.map(item => {
    const result: any = { record_id: item.record_id };
    item.contributions.forEach(c => {
      result[c.test_name] = c.score;
    });
    return result;
  });

  // Extract all unique test names for the legend/bars
  const allTests = Array.from(
    new Set(displayData.flatMap(item => item.contributions.map(c => c.test_name)))
  );

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Contribution Breakdown</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={transformedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <XAxis type="number" domain={[0, 'dataMax']} tick={{ fontSize: 12 }} />
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
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          {allTests.map((test, index) => (
            <Bar 
              key={test} 
              dataKey={test} 
              stackId="a" 
              fill={COLORS[index % COLORS.length]} 
              radius={
                index === allTests.length - 1 
                  ? [0, 4, 4, 0] // Only round right side of last item
                  : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
