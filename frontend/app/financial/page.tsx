'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Settings2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFinancialStatementCSV, runDetection, getExceptions, updateCaseStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { UploadModal } from '@/components/ui/upload-modal';
import { LoadButton } from '@/components/ui/load-button';
import { StatusSelect } from '@/components/ui/status-select';
import { FilterChips } from '@/components/ui/filter-chips';
import { Slider } from '@/components/ui/slider';

export default function FinancialAnalysisPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [thresholds, setThresholds] = useState({
    isolation_forest_contamination: 0.05,
    lof_contamination: 0.05,
  });

  useEffect(() => {
    const id = localStorage.getItem('financial_dataset_id');
    if (id) {
      setDatasetId(id);
      fetchExceptions();
    }
  }, []);

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      const data = await getExceptions({ domain: 'financial_statement', limit: 100 });
      setExceptions(data);
    } catch (error) {
      toast.error('Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const res = await uploadFinancialStatementCSV(file);
      if (res.dataset_id) {
        setDatasetId(res.dataset_id);
        localStorage.setItem('financial_dataset_id', res.dataset_id);
        toast.success('Financial dataset uploaded successfully');
        setIsUploadModalOpen(false);
      }
    } catch (error) {
      toast.error('Upload failed');
    }
  };

  const handleRunDetection = async () => {
    if (!datasetId) {
      toast.error('Upload a dataset first');
      return;
    }
    try {
      const user = localStorage.getItem('audit_user') || 'demo_user';
      await runDetection({ domain: 'financial_statement', dataset_id: datasetId, thresholds, run_by: user });
      toast.success('Detection complete');
      fetchExceptions();
    } catch (error) {
      toast.error('Detection failed');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const user = localStorage.getItem('audit_user') || 'demo_user';
      await updateCaseStatus(id, newStatus, user);
      setExceptions(exceptions.map(e => e.id === id ? { ...e, status: newStatus } : e));
      toast.success('Status updated');
    } catch (error) {
      toast.error('Status update failed');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredExceptions = exceptions
    .filter(e => (statusFilter === 'all' || e.status === statusFilter) && e.ensemble_score >= minScore)
    .sort((a, b) => b.ensemble_score - a.ensemble_score);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-white min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Statement Analysis</h1>
          <p className="text-gray-500">Detect anomalies in company financial records and statements.</p>
        </div>
        <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm">
          <Upload className="w-4 h-4" />
          <span>Upload CSV</span>
        </button>
      </div>

      {!datasetId && (
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-12 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Dataset Uploaded</h3>
          <p className="text-gray-500 mb-6">Upload a financial statement CSV to begin analysis.</p>
          <button onClick={() => setIsUploadModalOpen(true)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors">
            Select File
          </button>
        </div>
      )}

      {datasetId && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => setShowThresholds(!showThresholds)} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Settings2 className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Analysis Configuration</h3>
              </div>
              {showThresholds ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            
            <AnimatePresence>
              {showThresholds && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Slider label="Isolation Forest Contamination" value={thresholds.isolation_forest_contamination} onChange={(v) => setThresholds({...thresholds, isolation_forest_contamination: v})} min={0.01} max={0.2} step={0.01} />
                    <Slider label="LOF Contamination" value={thresholds.lof_contamination} onChange={(v) => setThresholds({...thresholds, lof_contamination: v})} min={0.01} max={0.2} step={0.01} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center space-x-4">
            <LoadButton onClick={handleRunDetection} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 font-medium shadow-sm">
              <Play className="w-4 h-4" />
              <span>Run Detection</span>
            </LoadButton>
            <p className="text-sm text-gray-500">Dataset ID: <span className="font-mono text-gray-900">{datasetId}</span></p>
          </div>

          {exceptions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-slate-50 rounded-t-xl">
                <FilterChips 
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Needs Review', value: 'needs_review' },
                    { label: 'Confirmed', value: 'confirmed' },
                    { label: 'False Positive', value: 'false_positive' },
                    { label: 'Unreviewed', value: 'unreviewed' }
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <div className="w-48">
                  <Slider label="Min Score" value={minScore} onChange={setMinScore} min={0} max={100} step={1} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Record ID</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExceptions.map((ex) => (
                      <React.Fragment key={ex.id}>
                        <tr className="bg-white border-b border-gray-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-gray-900">{ex.source_record_id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div className={cn("h-2 rounded-full", ex.ensemble_score > 75 ? 'bg-red-500' : ex.ensemble_score > 50 ? 'bg-amber-500' : 'bg-blue-500')} style={{ width: `${ex.ensemble_score}%` }}></div>
                              </div>
                              <span className="font-medium">{ex.ensemble_score.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusSelect currentStatus={ex.status} onStatusChange={(v) => handleStatusChange(ex.id, v)} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => toggleRow(ex.id)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                              {expandedRows[ex.id] ? 'Hide Details' : 'View Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows[ex.id] && (
                          <tr className="bg-slate-50 border-b border-gray-200">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="space-y-4 max-w-3xl">
                                <h4 className="font-semibold text-gray-900 mb-2">Flagged Reasons</h4>
                                {ex.reason_codes.map((rc: any, i: number) => (
                                  <div key={i} className="flex items-start space-x-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex-1">
                                      <div className="flex justify-between mb-1">
                                        <span className="font-medium text-gray-900">{rc.test_name}</span>
                                        <span className="text-sm font-semibold text-gray-600">{rc.contribution_score.toFixed(1)}</span>
                                      </div>
                                      <p className="text-sm text-gray-600">{rc.explanation}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {filteredExceptions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No exceptions match the current filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {isUploadModalOpen && (
        <UploadModal 
          open={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)} 
          onUpload={handleUpload}
          title="Upload Financial Data"
          description="Required columns: ticker, fiscal_year, revenue, cogs, receivables, current_assets, ppe, total_assets, depreciation, sga_expense, current_liabilities, long_term_debt, net_income, cash_flow_ops, retained_earnings, market_value_equity, total_liabilities"
        />
      )}
    </div>
  );
}
