const BASE = '/api';

export interface LedgerUploadResponse {
  dataset_id: string;
  rows_ingested: number;
  vendors_detected: number;
  date_range?: [string, string] | null;
  warnings?: string[];
}

export interface CuratedCompany {
  ticker: string;
  company_name: string;
  is_aaer_fraud_case: boolean;
  sector?: string;
}

export interface ThresholdConfig {
  benford_sensitivity?: number;
  duplicate_similarity_threshold?: number;
  isolation_forest_contamination?: number;
  lof_contamination?: number;
  three_way_match_tolerance_pct?: number;
}

export interface ReasonCodeOut {
  test_name: string;
  contribution_score: number;
  explanation: string;
}

export interface ExceptionOut {
  id: number;
  domain: string;
  source_record_id: string;
  ensemble_score: number;
  individual_scores: Record<string, number>;
  status: string;
  reason_codes: ReasonCodeOut[];
  created_at: string;
}

export interface DetectionRunResponse {
  run_id: number;
  domain: string;
  dataset_id: string;
  total_records_scanned: number;
  total_exceptions: number;
  exceptions: ExceptionOut[];
}

export interface CaseStatusUpdateResponse {
  exception_id: number;
  status: string;
  reviewer: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  run_timestamp: string;
  dataset_used: string;
  modules_run: string[];
  parameters: Record<string, any>;
  run_by: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

export interface MetricScores {
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkResult {
  domain: string;
  baseline: MetricScores;
  ensemble: MetricScores;
  computed_at: string;
}

export async function uploadLedgerCSV(file: File): Promise<LedgerUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/ingest/ledger/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function uploadFinancialStatementCSV(file: File): Promise<LedgerUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/ingest/financial-statements/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function getCompanies(): Promise<{ companies: CuratedCompany[] }> {
  const res = await fetch(`${BASE}/ingest/companies`);
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export async function runDetection(params: { domain: string; dataset_id: string; thresholds?: ThresholdConfig; run_by?: string }): Promise<DetectionRunResponse> {
  const res = await fetch(`${BASE}/detect/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Detection run failed' }));
    throw new Error(err.detail || 'Detection run failed');
  }
  return res.json();
}

export async function getExceptions(params?: { domain?: string; status?: string; min_score?: number; limit?: number; offset?: number }): Promise<ExceptionOut[]> {
  const query = new URLSearchParams();
  if (params) {
    if (params.domain) query.append('domain', params.domain);
    if (params.status) query.append('status', params.status);
    if (params.min_score !== undefined) query.append('min_score', params.min_score.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.offset !== undefined) query.append('offset', params.offset.toString());
  }
  const url = `${BASE}/detect/exceptions${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exceptions');
  return res.json();
}

export async function updateCaseStatus(exceptionId: number, status: string, reviewer: string, note?: string): Promise<CaseStatusUpdateResponse> {
  const res = await fetch(`${BASE}/cases/${exceptionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewer, note }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function getAuditLogs(params?: { start_date?: string; end_date?: string; module?: string; limit?: number; offset?: number }): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params) {
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.module) query.append('module', params.module);
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.offset !== undefined) query.append('offset', params.offset.toString());
  }
  const url = `${BASE}/audit/logs${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function getBenchmark(domain: string): Promise<BenchmarkResult> {
  const res = await fetch(`${BASE}/benchmark/${domain}`);
  if (!res.ok) throw new Error('Failed to fetch benchmark');
  return res.json();
}

export async function runBenchmark(domain: string, datasetId?: string): Promise<BenchmarkResult> {
  const url = `${BASE}/benchmark/${domain}/run${datasetId ? `?dataset_id=${datasetId}` : ''}`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to run benchmark' }));
    throw new Error(err.detail || 'Failed to run benchmark');
  }
  return res.json();
}
