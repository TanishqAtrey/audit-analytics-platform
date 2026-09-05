'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, FileX, Clock, Upload, Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getExceptions } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ScoreDistribution } from '@/components/charts/score-distribution';
import { StatusBreakdown } from '@/components/charts/status-breakdown';

export default function HomeDashboard() {
  const [username, setUsername] = useState('demo_user');
  const [ledgerDataset, setLedgerDataset] = useState<string | null>(null);
  const [financialDataset, setFinancialDataset] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, falsePositive: 0, pending: 0 });
  const [topExceptions, setTopExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('audit_user') || 'demo_user';
    setUsername(user);
    setLedgerDataset(localStorage.getItem('ledger_dataset_id'));
    setFinancialDataset(localStorage.getItem('financial_dataset_id'));

    const fetchData = async () => {
      try {
        const data = await getExceptions({ limit: 100 });
        setTopExceptions(data.slice(0, 10));
        
        const counts = {
          total: data.length,
          confirmed: data.filter((e: any) => e.status === 'confirmed').length,
          falsePositive: data.filter((e: any) => e.status === 'false_positive').length,
          pending: data.filter((e: any) => e.status === 'unreviewed' || e.status === 'needs_review').length,
        };
        setStats(counts);
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-white min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {username}</h1>
        <p className="text-gray-500">Here is an overview of your audit analytics workspace.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Exceptions" value={stats.total} icon={<Activity className="text-blue-500" />} color="border-l-blue-500" loading={loading} />
        <StatCard title="Confirmed Frauds" value={stats.confirmed} icon={<AlertTriangle className="text-red-500" />} color="border-l-red-500" loading={loading} />
        <StatCard title="False Positives" value={stats.falsePositive} icon={<CheckCircle2 className="text-green-500" />} color="border-l-green-500" loading={loading} />
        <StatCard title="Pending Review" value={stats.pending} icon={<Clock className="text-amber-500" />} color="border-l-amber-500" loading={loading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Dataset Status</h2>
            <div className="space-y-4">
              <DatasetStatusCard domain="Ledger" datasetId={ledgerDataset} link="/ledger" />
              <DatasetStatusCard domain="Financial Statements" datasetId={financialDataset} link="/financial" />
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Status Breakdown</h2>
            <div className="h-64">
              <StatusBreakdown data={topExceptions} />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Top Exceptions</h2>
          <div className="h-80">
            <ScoreDistribution data={topExceptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, loading }: { title: string, value: number, icon: React.ReactNode, color: string, loading: boolean }) {
  return (
    <motion.div whileHover={{ y: -2 }} className={cn("bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-l-4", color)}>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          )}
        </div>
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      </div>
    </motion.div>
  );
}

function DatasetStatusCard({ domain, datasetId, link }: { domain: string, datasetId: string | null, link: string }) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-slate-50">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-white rounded-md border border-gray-200">
          <FileX className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{domain}</p>
          <p className="text-sm text-gray-500">{datasetId ? `ID: ${datasetId}` : 'No data uploaded'}</p>
        </div>
      </div>
      <Link href={link} className="flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-colors">
        <Upload className="w-4 h-4" />
        <span>Upload</span>
      </Link>
    </div>
  );
}
