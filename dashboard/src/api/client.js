/**
 * src/api/client.js
 * Single HTTP seam. Falls back to rich mock data when backend is unreachable.
 */
import axios from 'axios'
import { API_CONFIG, DEFAULTS } from '../config/constants'

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const api  = axios.create({ baseURL: `${BASE}/api`, timeout: API_CONFIG.TIMEOUT_MS })

/* ── safe fetch wrapper ──────────────────────────────────────────── */
async function get(path, params) {
  try {
    const res = await api.get(path, { params })
    return res.data
  } catch { return null }
}

async function getWithHeaders(path, params) {
  try {
    const res = await api.get(path, { params })
    return { data: res.data, headers: res.headers || {} }
  } catch { return { data: null, headers: {} } }
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

export async function getLedgerExceptions(threshold = DEFAULTS.DETECTION_THRESHOLD, limit = 100, offset = 0, sortBy = 'score_desc', status = null) {
  const params = { domain: 'ledger', min_score: threshold, limit, offset }
  if (sortBy) params.sort_by = sortBy
  if (status) params.status = status
  const { data, headers } = await getWithHeaders('/detect/exceptions', params)
  if (!data || !Array.isArray(data)) return []
  
  const mapped = data.map(e => ({
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

  const rawTotal = headers['x-total-count'] || headers['X-Total-Count']
  mapped.total = rawTotal != null ? parseInt(rawTotal, 10) : mapped.length
  return mapped
}

export async function getFsExceptions(threshold = DEFAULTS.FS_DETECTION_THRESHOLD, limit = 100, offset = 0, sortBy = 'score_desc', status = null) {
  const params = { domain: 'financial_statement', min_score: threshold, limit, offset }
  if (sortBy) params.sort_by = sortBy
  if (status) params.status = status
  const { data, headers } = await getWithHeaders('/detect/exceptions', params)
  if (!data || !Array.isArray(data)) return []
  
  const mapped = data.map(e => ({
    id: e.id,
    ticker: e.ticker || 'N/A',
    company: e.company || 'Unknown Company',
    fiscal_year: e.fiscal_year || 2023,
    m_score: e.m_score != null && !isNaN(Number(e.m_score)) ? Number(e.m_score) : null,
    z_score: e.z_score != null && !isNaN(Number(e.z_score)) ? Number(e.z_score) : null,
    altman_zone: e.altman_zone || null,
    altman_ratios: e.altman_ratios || null,
    beneish_ratios: e.beneish_ratios || null,
    ensemble_score: e.ensemble_score,
    status: e.status,
    reasons: (e.reason_codes || []).map(rc => ({
      code: rc.test_name,
      label: rc.explanation || rc.test_name,
      weight: rc.contribution_score
    })),
    domain: 'financial_statement'
  }))

  const rawTotal = headers['x-total-count'] || headers['X-Total-Count']
  mapped.total = rawTotal != null ? parseInt(rawTotal, 10) : mapped.length
  return mapped
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

export async function getBenchmarkResults(domain = 'ledger') {
  const data = await get(`/benchmark/${domain}`)
  if (!data) return null

  const thresholds = data.thresholds || [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  const bp = Array.isArray(data.baseline?.precision) ? data.baseline.precision : []
  const br = Array.isArray(data.baseline?.recall) ? data.baseline.recall : []
  const bf = Array.isArray(data.baseline?.f1) ? data.baseline.f1 : []
  const ep = Array.isArray(data.ensemble?.precision) ? data.ensemble.precision : []
  const er = Array.isArray(data.ensemble?.recall) ? data.ensemble.recall : []
  const ef = Array.isArray(data.ensemble?.f1) ? data.ensemble.f1 : []

  const midIdx = Math.min(2, ef.length - 1, bf.length - 1)
  const baseP = bp[midIdx] || 0
  const ensP = ep[midIdx] || 0
  const precLiftPct = baseP > 0 ? Math.round((ensP - baseP) / baseP * 1000) / 10 : 0
  const f1LiftPct = bf[midIdx] > 0 ? Math.round((ef[midIdx] - bf[midIdx]) / bf[midIdx] * 1000) / 10 : 0

  const baseFPR = Math.max(1 - baseP, 0)
  const ensFPR = Math.max(1 - ensP, 0)
  const fpReductionPct = baseFPR > 0 ? Math.min(100, Math.max(0, Math.round((baseFPR - ensFPR) / baseFPR * 1000) / 10)) : 0

  return {
    thresholds,
    baseline_precision: bp,
    baseline_recall: br,
    ensemble_precision: ep,
    ensemble_recall: er,
    baseline_f1: bf,
    ensemble_f1: ef,
    false_positive_reduction_pct: fpReductionPct,
    precision_lift_pct: precLiftPct,
    f1_lift_pct: f1LiftPct,
  }
}

export async function getThresholdMetrics(domain = 'ledger') {
  const data = await get('/detect/threshold-metrics', { domain })
  if (data && Array.isArray(data.scores)) return data

  const [ex, bm, stats] = await Promise.all([
    domain === 'ledger' ? getLedgerExceptions(0.0, 10000) : getFsExceptions(0.0),
    getBenchmarkResults(domain).catch(() => null),
    getSummaryStats().catch(() => null)
  ])
  const totalRecords = domain === 'ledger' ? (stats?.total_transactions || 0) : (stats?.fs_exceptions || 0)
  const scores = (ex || []).map(e => e.ensemble_score).filter(s => s != null)
  return {
    domain,
    total_records: totalRecords || ex?.total || scores.length,
    total_exceptions: ex?.total || scores.length,
    scores,
    benchmark: bm
  }
}

export async function runBenchmark(domain = 'ledger', datasetId = null) {
  const url = datasetId ? `/benchmark/${domain}/run?dataset_id=${datasetId}` : `/benchmark/${domain}/run`
  return post(url)
}

export async function getBenfordAnalysis(domain = 'ledger') {
  const data = await get('/detect/benford', { domain })
  if (!data || (data.mad === 0 && data.chi2_p === 1)) return null
  return data
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

export async function getCuratedCompanies() {
  const data = await get('/ingest/companies')
  return data ?? { companies: [] }
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

export async function uploadFinancialStatementCsv(file, replaceExisting = true) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await api.post('/ingest/financial-statements/upload', fd, {
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
  return await post('/ingest/financial-statements/select', { tickers, fiscal_years: fiscalYears })
}

