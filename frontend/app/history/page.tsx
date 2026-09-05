'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown, ChevronUp, Calendar, User, Search, Database } from 'lucide-react';
import { getAuditLogs } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FilterChips } from '@/components/ui/filter-chips';

export default function HistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs({ limit: 100 });
      setLogs(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => moduleFilter === 'all' || log.module === moduleFilter);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 bg-white min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Detection Run History</h1>
        <p className="text-gray-500">Audit trail of all analysis runs and configuration changes.</p>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-gray-200">
        <FilterChips 
          options={[
            { label: 'All Modules', value: 'all' },
            { label: 'Detection Run', value: 'detection_run' },
            { label: 'Status Update', value: 'status_update' }
          ]}
          value={moduleFilter}
          onChange={setModuleFilter}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-gray-200">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No history found</h3>
          <p className="text-gray-500">Run your first analysis to see history here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div key={log.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden transition-all hover:border-gray-300">
              <button 
                onClick={() => toggleExpand(log.id)}
                className="w-full text-left p-5 flex items-center justify-between bg-white"
              >
                <div className="flex items-center space-x-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Run #{log.id.substring(0, 8)}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center space-x-1"><Calendar className="w-3.5 h-3.5" /> <span>{new Date(log.created_at).toLocaleString()}</span></span>
                      <span className="flex items-center space-x-1"><User className="w-3.5 h-3.5" /> <span>{log.user_id}</span></span>
                      <span className="flex items-center space-x-1"><Database className="w-3.5 h-3.5" /> <span>{log.module}</span></span>
                    </div>
                  </div>
                </div>
                {expandedId === log.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              <AnimatePresence>
                {expandedId === log.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 bg-slate-50"
                  >
                    <div className="p-6">
                      <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Details</h5>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800 overflow-x-auto">
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
