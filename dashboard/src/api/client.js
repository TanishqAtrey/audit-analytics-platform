/**
 * src/api/client.js
 * Single HTTP seam. Falls back to rich mock data when backend is unreachable.
 */
import axios from 'axios'
import { API_CONFIG, DEFAULTS } from '../config/constants'

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const api  = axios.create({ baseURL: `${BASE}/api`, timeout: API_CONFIG.TIMEOUT_MS })

/* ── helpers ─────────────────────────────────────────────────────── */
const rnd  = (min, max) => Math.random() * (max - min) + min
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const seed = (s) => { /* deterministic-ish seeding via closure */ let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280 } }

/* ── mock data generators ────────────────────────────────────────── */
const VENDORS = ['Apex Solutions Ltd','BrightPath Consulting','CoreTech Systems',
  'Delta Finance Group','Eagle Eye Analytics','FrontLine Services','GlobalData Inc',
  'Horizon Partners','Infinity Solutions','JetStream Corp','Keystone Advisory','Luminary Holdings']
const MODULES  = ['Benford Ensemble','Duplicate Detection','3-Way Match','Beneish M-Score','Altman Z-Score','Isolation Forest','LOF']
const DATASETS = ['ledger_q4_2023.csv','financials_2023.parquet','synthetic_po_gr.csv','sec_edgar_curated.parquet']
const STATUSES = ['unreviewed','confirmed','false_positive','needs_review']
const TICKERS  = ['ENRN','WCOM','TYCO','HLTH','IMCL','AAPL','MSFT','AMZN','TSLA','META','NVDA','GOOGL']

const REASON_POOL = [
  { code:'BENFORD_1ST',  label:'Benford 1st-digit deviation' },
  { code:'BENFORD_2ND',  label:'Benford 2nd-digit deviation' },
  { code:'DUPLICATE_INV',label:'Near-duplicate invoice' },
  { code:'THREE_WAY',    label:'PO–Invoice–GR mismatch' },
  { code:'ISO_FOREST',   label:'Isolation Forest outlier' },
  { code:'LOF_SCORE',    label:'LOF proximity anomaly' },
  { code:'AMT_CLUSTER',  label:'Unusual amount clustering' },
  { code:'VENDOR_FREQ',  label:'Abnormal vendor frequency' },
]

function mockReasons(r) {
  const k = 2 + Math.floor(r() * 3)
  const pool = [...REASON_POOL].sort(() => r() - 0.5).slice(0, k)
  return pool.map(p => ({ ...p, weight: Math.round((0.2 + r() * 0.8) * 100) / 100 }))
}

function mockLedgerExceptions(n = 30) {
  const r = seed(42)
  return Array.from({ length: n }, (_, i) => {
    const score = Math.round((0.35 + r() * 0.64) * 1000) / 1000
    const d = new Date(2024, 0, 1 + Math.floor(r() * 364))
    return {
      id: i + 1,
      vendor: VENDORS[Math.floor(r() * VENDORS.length)],
      invoice_number: `INV-${10000 + Math.floor(r() * 89999)}`,
      amount: Math.round((500 + r() * 449500) * 100) / 100,
      date: d.toISOString().slice(0, 10),
      ensemble_score: score,
      status: STATUSES[Math.floor(r() * 4)],
      reasons: mockReasons(r),
      domain: 'ledger',
    }
  }).sort((a, b) => b.ensemble_score - a.ensemble_score)
}

function mockFsExceptions(n = 16) {
  const r = seed(7)
  return TICKERS.slice(0, n).map((ticker, i) => ({
    id: i + 1,
    ticker,
    company: `${ticker} Corporation`,
    fiscal_year: [2021, 2022, 2023][Math.floor(r() * 3)],
    m_score: Math.round((-3.5 + r() * 4) * 100) / 100,
    z_score: Math.round((0.8 + r() * 4.4) * 100) / 100,
    ensemble_score: Math.round((0.3 + r() * 0.67) * 1000) / 1000,
    status: STATUSES[Math.floor(r() * 4)],
    reasons: mockReasons(r),
    domain: 'financial_statement',
  })).sort((a, b) => b.ensemble_score - a.ensemble_score)
}

function mockAuditLog(n = 40) {
  const r = seed(11)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(2024, 0, 1 + Math.floor(r() * 364))
    d.setHours(Math.floor(r() * 24))
    return {
      id: i + 1,
      timestamp: d.toISOString(),
      module: MODULES[Math.floor(r() * MODULES.length)],
      dataset: DATASETS[Math.floor(r() * DATASETS.length)],
      threshold: Math.round((0.3 + r() * 0.6) * 100) / 100,
      exceptions_found: Math.floor(r() * 120),
      runtime_ms: 120 + Math.floor(r() * 7880),
      run_by: `analyst_${1 + Math.floor(r() * 3)}`,
    }
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function mockBenchmark() {
  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  const bp = [0.41, 0.47, 0.52, 0.57, 0.63, 0.70, 0.78]
  const br = [0.91, 0.85, 0.78, 0.70, 0.61, 0.50, 0.38]
  const ep = [0.58, 0.65, 0.73, 0.80, 0.86, 0.91, 0.95]
  const er = [0.93, 0.88, 0.84, 0.78, 0.71, 0.62, 0.50]
  const f1 = (p, r) => Math.round(2 * p * r / (p + r) * 1000) / 1000
  return {
    thresholds,
    baseline_precision: bp, baseline_recall: br,
    ensemble_precision: ep, ensemble_recall: er,
    baseline_f1: bp.map((p, i) => f1(p, br[i])),
    ensemble_f1: ep.map((p, i) => f1(p, er[i])),
    false_positive_reduction_pct: 31.4,
    precision_lift_pct: 23.8,
  }
}

function mockBenford() {
  const expected = {}; const observed = {}
  const r = seed(99)
  for (let d = 1; d <= 9; d++) {
    expected[d] = Math.round(Math.log10(1 + 1/d) * 10000) / 10000
    observed[d] = Math.round((expected[d] + (r() - 0.5) * 0.08) * 10000) / 10000
  }
  observed[1] = Math.round((observed[1] - 0.05) * 10000) / 10000
  observed[5] = Math.round((observed[5] + 0.065) * 10000) / 10000
  return { expected, observed, mad: 0.0127, chi2_p: 0.031 }
}

function mockStats() {
  return {
    total_transactions: 14832, ledger_exceptions: 247, fs_exceptions: 18,
    confirmed_fraud: 34, false_positives: 89, needs_review: 61,
    precision: 0.812, recall: 0.774, f1_score: 0.793,
    last_run: '2024-12-01T14:32:00', ensemble_vs_baseline: '+23.8%',
  }
}

/* ── safe fetch wrapper ──────────────────────────────────────────── */
async function get(path, params) {
  try {
    const res = await api.get(path, { params })
    return res.data
  } catch { return null }
}

async function post(path, data) {
  try {
    const res = await api.post(path, data)
    return res.data
  } catch { return null }
}

async function patch(path, data) {
  try {
    const res = await api.patch(path, data)
    return res.data
  } catch { return null }
}

/* ── Public API ──────────────────────────────────────────────────── */
export async function healthCheck() {
  try {
    const res = await axios.get(`${BASE}/health`, { timeout: API_CONFIG.HEALTH_CHECK_TIMEOUT_MS })
    return res.status === 200
  } catch { return false }
}

export async function getSummaryStats() {
  const data = await get('/detect/summary')
  return data ?? {
    total_transactions: 0, ledger_exceptions: 0, fs_exceptions: 0,
    confirmed_fraud: 0, false_positives: 0, needs_review: 0,
    precision: 0, recall: 0, f1_score: 0,
    last_run: null, ensemble_vs_baseline: null,
  }
}

export async function getLedgerExceptions(threshold = DEFAULTS.DETECTION_THRESHOLD) {
  const data = await get('/detect/exceptions', { domain: 'ledger', min_score: threshold })
  if (!data || !Array.isArray(data)) return []
  
  return data.map(e => ({
    id: e.id,
    vendor: e.vendor || 'Unknown Vendor',
    invoice_number: e.invoice_number || 'N/A',
    amount: e.amount || 0,
    currency: e.currency || DEFAULTS.CURRENCY,
    date: e.date || '',
    ensemble_score: e.ensemble_score,
    status: e.status,
    reasons: (e.reason_codes || []).map(rc => ({
      code: rc.test_name,
      label: rc.explanation || rc.test_name,
      weight: rc.contribution_score
    })),
    domain: 'ledger'
  }))
}

export async function getFsExceptions(threshold = DEFAULTS.DETECTION_THRESHOLD) {
  const data = await get('/detect/exceptions', { domain: 'financial_statement', min_score: threshold })
  if (!data || !Array.isArray(data)) return []
  
  return data.map(e => ({
    id: e.id,
    ticker: e.ticker || 'N/A',
    company: e.company || 'Unknown Company',
    fiscal_year: e.fiscal_year || 2023,
    m_score: e.m_score != null && !isNaN(Number(e.m_score)) ? Number(e.m_score) : null,
    z_score: e.z_score != null && !isNaN(Number(e.z_score)) ? Number(e.z_score) : null,
    ensemble_score: e.ensemble_score,
    status: e.status,
    reasons: (e.reason_codes || []).map(rc => ({
      code: rc.test_name,
      label: rc.explanation || rc.test_name,
      weight: rc.contribution_score
    })),
    domain: 'financial_statement'
  }))
}

export async function quickLoadFinancialStatements(tickers = ['AAPL', 'MSFT', 'AMZN', 'ENRN', 'WCOM', 'TYCO', 'HLTH'], years = [2021, 2022, 2023]) {
  const selResult = await selectFinancialStatements(tickers, years)
  if (!selResult) return null
  const runResult = await triggerDetectionRun('financial_statement', DEFAULTS.FS_DETECTION_THRESHOLD, selResult.dataset_id || 'sec_curated_statements')
  return { ...selResult, total_exceptions: runResult?.total_exceptions ?? 0 }
}


export async function updateExceptionStatus(id, status, reviewer = 'analyst') {
  return (await patch(`/cases/${id}/status`, { status, reviewer })) !== null
}

export async function getAuditLog(limit = 100) {
  const data = await get('/audit/logs', { limit })
  if (!data || !data.entries) return []
  
  return data.entries.map(r => ({
    id: r.id,
    timestamp: r.run_timestamp,
    module: (r.modules_run || []).join(', ') || 'Ensemble Pipeline',
    modules_list: r.modules_run || [],
    dataset: r.dataset_used || 'system_batch',
    threshold: r.parameters?.benford_sensitivity ?? DEFAULTS.DETECTION_THRESHOLD,
    parameters: r.parameters || {},
    exceptions_found: r.parameters?.total_exceptions ?? 0,
    runtime_ms: r.parameters?.runtime_ms ?? 0,
    run_by: r.run_by || 'analyst'
  }))
}

export async function getBenchmarkResults() {
  const data = await get('/benchmark/ledger')
  if (!data) return null

  const thresholds = data.thresholds || [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  const bp = Array.isArray(data.baseline?.precision) ? data.baseline.precision : []
  const br = Array.isArray(data.baseline?.recall) ? data.baseline.recall : []
  const bf = Array.isArray(data.baseline?.f1) ? data.baseline.f1 : []
  const ep = Array.isArray(data.ensemble?.precision) ? data.ensemble.precision : []
  const er = Array.isArray(data.ensemble?.recall) ? data.ensemble.recall : []
  const ef = Array.isArray(data.ensemble?.f1) ? data.ensemble.f1 : []

  const f1calc = (p, r) => (p + r > 0) ? Math.round(2 * p * r / (p + r) * 1000) / 1000 : 0
  // Compute lift from mid-threshold (index 2 = 0.5)
  const midIdx = Math.min(2, ef.length - 1, bf.length - 1)
  const liftPct = bf[midIdx] > 0 ? Math.round((ef[midIdx] - bf[midIdx]) / bf[midIdx] * 1000) / 10 : 0

  return {
    thresholds,
    baseline_precision: bp,
    baseline_recall: br,
    ensemble_precision: ep,
    ensemble_recall: er,
    baseline_f1: bf,
    ensemble_f1: ef,
    false_positive_reduction_pct: liftPct > 0 ? liftPct : 0.0,
    precision_lift_pct: liftPct > 0 ? liftPct : 0.0,
  }
}

export async function getBenfordAnalysis(domain = 'ledger') {
  const data = await get('/detect/benford', { domain })
  return data ?? null
}

export async function triggerDetectionRun(domain, threshold = DEFAULTS.DETECTION_THRESHOLD, datasetId, run_by = 'analyst') {
  const payload = {
    domain,
    dataset_id: datasetId,
    thresholds: {
      benford_sensitivity: threshold,
      duplicate_similarity_threshold: DEFAULTS.DUPLICATE_SIMILARITY_THRESHOLD,
      isolation_forest_contamination: DEFAULTS.ISOLATION_FOREST_CONTAMINATION,
      lof_contamination: DEFAULTS.LOF_CONTAMINATION,
      three_way_match_tolerance_pct: DEFAULTS.THREE_WAY_MATCH_TOLERANCE_PCT
    },
    run_by
  }
  return await post('/detect/run', payload)
}

const MOCK_COMPANIES = [
  { name: 'Apple Inc.', ticker: 'AAPL', description: 'Curated 40-company XBRL statements' },
  { name: 'Microsoft Corp.', ticker: 'MSFT', description: 'Curated 40-company XBRL statements' },
  { name: 'Amazon.com Inc.', ticker: 'AMZN', description: 'Curated 40-company XBRL statements' },
  { name: 'Enron Corp.', ticker: 'ENRN', description: 'Historical known earnings manipulator case' },
  { name: 'WorldCom Inc.', ticker: 'WCOM', description: 'Historical known capitalization fraud case' },
]

export async function getCuratedCompanies() {
  const data = await get('/ingest/companies')
  return data ?? { companies: MOCK_COMPANIES }
}

export async function uploadLedgerCsv(file, replaceExisting = true) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await api.post('/ingest/ledger/upload', fd, {
      params: { replace_existing: replaceExisting },
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  } catch {
    return null
  }
}

export async function resetPlatformData() {
  try {
    const res = await api.post('/ingest/reset')
    return res.data
  } catch {
    return null
  }
}

export async function selectFinancialStatements(tickers, fiscalYears) {
  return (await post('/ingest/financial-statements/select', { tickers, fiscal_years: fiscalYears }))
    ?? { dataset_id: 'mock-dataset-id', rows_loaded: 15, tickers_loaded: tickers, tickers_missing: [] }
}

