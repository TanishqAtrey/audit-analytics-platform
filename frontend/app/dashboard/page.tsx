'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, BarChart3, PieChart, ActivitySquare, LineChart } from 'lucide-react';
import { getExceptions } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ScoreDistribution } from '@/components/charts/score-distribution';
import { StatusBreakdown } from '@/components/charts/status-breakdown';
import { TestContributions } from '@/components/charts/test-contributions';
import { TimelineChart } from '@/components/charts/timeline-chart';
import { FilterChips } from '@/components/ui/filter-chips';

export default function VisualizationDashboard() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getExceptions({ limit: 500 });
      setExceptions(data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredExceptions = exceptions.filter(e => domainFilter === 'all' || e.domain === domainFilter);

  if (loading && exceptions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!loading && exceptions.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center h-96 bg-white rounded-xl border border-gray-200 mt-8">
        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
        <p className="text-gray-500">Run a detection analysis first to see visualization metrics here.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-white min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Visual overview of detected exceptions and patterns.</p>
        </div>
        <button onClick={fetchData} className="flex items-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex space-x-2">
        <FilterChips 
          options={[
            { label: 'All Domains', value: 'all' },
            { label: 'Ledger', value: 'ledger' },
            { label: 'Financial Statement', value: 'financial_statement' }
          ]}
          value={domainFilter}
          onChange={setDomainFilter}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Top Exceptions by Score" icon={<BarChart3 className="w-5 h-5 text-gray-500" />}>
          <ScoreDistribution data={filteredExceptions.slice(0, 15)} />
        </ChartCard>

        <ChartCard title="Status Breakdown" icon={<PieChart className="w-5 h-5 text-gray-500" />}>
          <StatusBreakdown data={filteredExceptions} />
        </ChartCard>

        <ChartCard title="Test Contributions" icon={<ActivitySquare className="w-5 h-5 text-gray-500" />}>
          <TestContributions data={filteredExceptions} />
        </ChartCard>

        <ChartCard title="Activity Timeline" icon={<LineChart className="w-5 h-5 text-gray-500" />}>
          <TimelineChart data={filteredExceptions} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col h-96">
      <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-100">
        {icon}
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}
