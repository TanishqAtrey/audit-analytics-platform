import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Typography, Card, CardContent, Divider,
  CircularProgress, Alert, LinearProgress, Tooltip, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, IconButton,
  Select, MenuItem, FormControl,
} from '@mui/material'
import {
  WarningAmber, CheckCircle, Pending, Assessment,
  TrendingUp, Security, DonutLarge,
  DeleteOutline, Refresh, Close, OpenInNew,
} from '@mui/icons-material'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import { Link, useNavigate } from 'react-router-dom'

import StatCard   from '../components/StatCard'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { getSummaryStats, getLedgerExceptions, getBenfordAnalysis, getAuditLog, healthCheck, resetPlatformData, updateExceptionStatus } from '../api/client'
import { StatusChip } from '../components/StatusChip'
import { formatCurrency } from '../utils/formatters'
import { DEFAULTS, THRESHOLDS } from '../config/constants'

/* ── Colour helpers ───────────────────────────────────────────────── */
const G = {
  purple: 'linear-gradient(195deg, #CE93D8, #AB47BC)',
  red:    'linear-gradient(195deg, #EF9A9A, #E53935)',
  orange: 'linear-gradient(195deg, #FFCC80, #FB8C00)',
  green:  'linear-gradient(195deg, #80CBC4, #00897B)',
  blue:   'linear-gradient(195deg, #90CAF9, #1976D2)',
  pink:   'linear-gradient(195deg, #F48FB1, #D81B60)',
}
const S = {
  purple: '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(156,39,176,.4)',
  red:    '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(244,67,54,.4)',
  orange: '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(255,152,0,.4)',
  green:  '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(76,175,80,.4)',
  blue:   '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(33,150,243,.4)',
  pink:   '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(216,27,96,.4)',
}

const STATUS_COLORS = {
  unreviewed:     '#1976d2',
  confirmed:      '#d32f2f',
  false_positive: '#388e3c',
  needs_review:   '#f57c00',
}

/* ── Custom tooltip for Recharts ──────────────────────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#3c4858' }}>{label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption" sx={{ color: '#666' }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong></Typography>
        </Box>
      ))}
    </Box>
  )
}

export default function Dashboard() {
  const [stats,     setStats]     = useState(null)
  const [ledger,    setLedger]    = useState([])
  const [benford,   setBenford]   = useState(null)
  const [log,       setLog]       = useState([])
  const [live,      setLive]      = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [resetting, setResetting] = useState(false)

  const mounted = React.useRef(true)
  const navigate = useNavigate()

  // Marked transactions modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalConfig, setModalConfig] = useState({
    title: '',
    status: null,
    minScore: 0,
    color: '#1976d2',
    icon: null,
    description: '',
    filterParam: '',
  })
  const [modalItems, setModalItems] = useState([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalUpdatingId, setModalUpdatingId] = useState(null)

  const handleOpenStatusModal = async (cfg) => {
    setModalConfig(cfg)
    setModalOpen(true)
    setModalLoading(true)
    try {
      const data = await getLedgerExceptions(cfg.minScore ?? 0, 100, 0, 'score_desc', cfg.status)
      setModalItems(data || [])
    } catch (e) {
      console.error('Failed to fetch modal transactions:', e)
      setModalItems([])
    } finally {
      setModalLoading(false)
    }
  }

  const handleStatusChangeInModal = async (id, newStatus) => {
    setModalUpdatingId(id)
    try {
      await updateExceptionStatus(id, newStatus)
      setModalItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item))
      getSummaryStats().then(s => { if (s && mounted.current) setStats(s) })
    } catch (e) {
      console.error('Failed to update status in modal:', e)
    } finally {
      setModalUpdatingId(null)
    }
  }

  const reloadData = () => {
    setLoading(true)
    Promise.all([
      healthCheck(),
      getSummaryStats(),
      getLedgerExceptions(DEFAULTS.MIN_EXCEPTION_SCORE),
      getBenfordAnalysis('ledger'),
      getAuditLog(30),
    ]).then(([ok, s, l, b, lg]) => {
      if (mounted.current) {
        setLive(ok); setStats(s); setLedger(l); setBenford(b); setLog(lg)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted.current) {
        setLoading(false)
      }
    })
  }

  useEffect(() => {
    mounted.current = true
    reloadData()
    return () => { mounted.current = false }
  }, [])

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all platform data to 0? This will remove all previously uploaded transactions and exceptions.')) {
      return
    }
    setResetting(true)
    await resetPlatformData()
    setResetting(false)
    reloadData()
  }

  const formatReasonLabel = (fullLabel) => {
    if (!fullLabel) return 'Anomaly'
    const lower = fullLabel.toLowerCase()
    if (lower.includes('3-way') || lower.includes('three-way') || lower.includes('po')) return '3-Way Mismatch'
    if (lower.includes('benford 1st') || lower.includes('first digit')) return 'Benford 1st-Digit'
    if (lower.includes('benford 2nd') || lower.includes('second digit')) return 'Benford 2nd-Digit'
    if (lower.includes('benford')) return "Benford's Law"
    if (lower.includes('duplicate') || lower.includes('fuzz')) return 'Duplicate Invoice'
    if (lower.includes('isolation') || lower.includes('forest')) return 'Isolation Forest'
    if (lower.includes('lof') || lower.includes('local outlier')) return 'LOF Outlier'
    if (lower.includes('cluster') || lower.includes('amount')) return 'Amount Cluster'
    if (lower.includes('round') || lower.includes('threshold')) return 'Near Threshold'
    return fullLabel.length > 18 ? fullLabel.slice(0, 16) + '…' : fullLabel
  }

  const reasonCodeCounts = useMemo(() => {
    if (stats?.anomaly_drivers && stats.anomaly_drivers.length > 0) {
      return stats.anomaly_drivers
    }
    const counts = {}
    const list = Array.isArray(ledger) ? ledger : []
    list.forEach(e => {
      (e.reasons || []).forEach(r => {
        const shortName = formatReasonLabel(r.label || r.code)
        counts[shortName] = (counts[shortName] || 0) + 1
      })
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [stats?.anomaly_drivers, ledger])

  const topVendorAnomalies = useMemo(() => {
    if (stats?.top_vendors && stats.top_vendors.length > 0) {
      return stats.top_vendors
    }
    const vendors = {}
    const list = Array.isArray(ledger) ? ledger : []
    list.filter(e => (e.ensemble_score ?? 0) >= 0.5).forEach(e => {
      if (e.vendor) {
        vendors[e.vendor] = (vendors[e.vendor] || 0) + (Number(e.amount) || 0)
      }
    })
    return Object.entries(vendors)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [stats?.top_vendors, ledger])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    )
  }

  /* ── Derived data ─────────────────────────────────────────────── */
  const statusCounts = stats?.ledger_exceptions != null && stats.ledger_exceptions > 0 ? {
    unreviewed: Math.max(0, (stats.ledger_exceptions || 0) - (stats.confirmed_fraud || 0) - (stats.false_positives || 0) - (stats.needs_review || 0)),
    confirmed: stats.confirmed_fraud || 0,
    false_positive: stats.false_positives || 0,
    needs_review: stats.needs_review || 0,
  } : ledger.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1; return acc
  }, {})

  const pieData = Object.entries(statusCounts)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => ({
      name: k.replace('_', ' '), value: v, fill: STATUS_COLORS[k],
    }))

  const benfordChartData = benford
    ? Array.from({ length: 9 }, (_, i) => ({
        digit: String(i + 1),
        Expected: +(benford.expected[i + 1] * 100).toFixed(2),
        Observed: +(benford.observed[i + 1] * 100).toFixed(2),
      }))
    : []

  const timelineData = log
    .slice(0, 20)
    .map(r => ({
      date: (r.timestamp || '').slice(5, 10),
      exceptions: r.exceptions_found,
      runtime: Math.round(r.runtime_ms / 100) / 10,
    }))
    .reverse()


  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <Box sx={{ mt: 4 }}>
      {/* Top Action Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Executive Audit Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Live accounts payable anomalies, Benford analysis, and ML risk indicators.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={reloadData}
            startIcon={<Refresh />}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, bgcolor: '#fff' }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleReset}
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutline />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#fff' }}
          >
            {resetting ? 'Resetting...' : 'Reset to 0'}
          </Button>
        </Box>
      </Box>

      {/* Status banner */}
      {!live && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Demo Mode</strong> — backend not reachable. All data is generated locally.
        </Alert>
      )}

      {/* Empty State Banner */}
      {live && (!stats?.total_transactions || stats.total_transactions === 0) && (
        <Alert
          severity="info"
          variant="filled"
          sx={{
            mb: 4,
            borderRadius: 3,
            bgcolor: '#1e293b',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#38bdf8' }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              component={Link}
              to="/upload"
              sx={{ textTransform: 'none', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600, mt: 0.5 }}
            >
              Go to Upload Data →
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Platform Clean / No Financial Data Uploaded</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
            The dashboard is at 0. Metrics, Benford charts, and ranked exceptions will appear once you ingest a CSV ledger in the Data Ingestion Portal.
          </Typography>
        </Alert>
      )}

      {/* ── Stat cards ────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 5 }} alignItems="stretch">
        {[
          {
            icon: <WarningAmber />, iconColor: G.orange, iconShadow: S.orange,
            title: 'Exceptions Flagged',
            value: (stats?.ledger_exceptions || 0).toLocaleString(),
            footer: 'Accounts Payable anomalies',
            onClick: () => handleOpenStatusModal({
              title: 'Flagged Ledger Exceptions',
              status: null,
              minScore: 0.5,
              color: '#fb8c00',
              icon: <WarningAmber />,
              description: 'All anomalies detected with ensemble risk score >= 0.50',
              filterParam: '',
            }),
          },
          {
            icon: <WarningAmber />, iconColor: G.red, iconShadow: S.red,
            title: 'Critical Flagged',
            value: (stats?.critical_flagged || 0).toLocaleString(),
            footer: 'Score ≥ 75%',
            trend: stats?.critical_flagged > 0 ? { value: 'High Risk', up: false } : undefined,
            onClick: () => handleOpenStatusModal({
              title: 'Critical Flagged Exceptions',
              status: null,
              minScore: 0.75,
              color: '#d32f2f',
              icon: <WarningAmber />,
              description: 'High-risk ledger transactions with ensemble score ≥ 75%',
              filterParam: '',
            }),
          },
          {
            icon: <CheckCircle />, iconColor: G.green, iconShadow: S.green,
            title: 'Confirmed Fraud',
            value: (stats?.confirmed_fraud || 0).toLocaleString(),
            footer: 'Reviewed by analysts',
            onClick: () => handleOpenStatusModal({
              title: 'Confirmed Fraud Transactions',
              status: 'confirmed',
              minScore: 0,
              color: '#00897b',
              icon: <CheckCircle />,
              description: 'Transactions confirmed as fraudulent or high-risk anomalies during audit review',
              filterParam: 'confirmed',
            }),
          },
          {
            icon: <Assessment />, iconColor: G.purple, iconShadow: S.purple,
            title: 'Total Transactions',
            value: (stats?.total_transactions || 0).toLocaleString(),
            footer: 'Across all datasets',
            onClick: () => navigate('/ledger'),
          },
          {
            icon: <TrendingUp />, iconColor: G.blue, iconShadow: S.blue,
            title: 'F1 Score',
            value: stats?.f1_score ? stats.f1_score.toFixed(3) : '0.000',
            footer: `Ensemble vs baseline: ${stats?.ensemble_vs_baseline || 'N/A'}`,
            trend: stats?.ensemble_vs_baseline ? { value: stats.ensemble_vs_baseline, up: true } : undefined,
            onClick: () => navigate('/benchmark'),
          },
          {
            icon: <Pending />, iconColor: G.pink, iconShadow: S.pink,
            title: 'Needs Review',
            value: (stats?.needs_review || 0).toLocaleString(),
            footer: 'Pending analyst action',
            onClick: () => handleOpenStatusModal({
              title: 'Transactions Needing Review',
              status: 'unreviewed',
              minScore: 0.5,
              color: '#d81b60',
              icon: <Pending />,
              description: 'Flagged exceptions awaiting auditor investigation and triage',
              filterParam: 'unreviewed',
            }),
          },
          {
            icon: <Security />, iconColor: G.red, iconShadow: S.red,
            title: 'False Positives',
            value: (stats?.false_positives || 0).toLocaleString(),
            footer: 'Cleared by reviewers',
            onClick: () => handleOpenStatusModal({
              title: 'False Positive Transactions',
              status: 'false_positive',
              minScore: 0,
              color: '#e53935',
              icon: <Security />,
              description: 'Transactions reviewed and cleared as benign false alarms',
              filterParam: 'false_positive',
            }),
          },
        ].map((card, i) => (
          <Grid item xs={12} sm={6} md={4} key={i} sx={{ display: 'flex' }}>
            <StatCard {...card} sx={{ width: '100%' }} />
          </Grid>
        ))}
      </Grid>

      {/* ── Chart cards row 1 ─────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Benford chart (green card) */}
        <Grid item xs={12} md={4}>
          <ChartCard
            color="linear-gradient(195deg, #66BB6A, #388E3C)"
            shadow={S.green}
            title="Benford's Law Analysis"
            subtitle={benford ? `MAD: ${benford.mad?.toFixed(4)} · χ² p: ${benford.chi2_p < 0.001 ? '< 0.001' : benford.chi2_p?.toFixed(3)}` : 'Awaiting data'}
            footer={benford ? `${benford.chi2_p < 0.05 ? 'Suspicious — p < 0.05' : 'Normal distribution'}` : 'Upload data to generate analysis'}
            headerHeight={180}
          >
            {benfordChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benfordChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <Bar dataKey="Expected" fill="rgba(255,255,255,0.3)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Observed" fill="rgba(255,255,255,0.85)" radius={[2, 2, 0, 0]} />
                  <XAxis dataKey="digit" tick={{ fill: '#fff', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <RTooltip content={<DarkTooltip />} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                <Assessment sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>No data available</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Upload a CSV to view chart</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Timeline chart (orange card) */}
        <Grid item xs={12} md={5}>
          <ChartCard
            color="linear-gradient(195deg, #FFA726, #FB8C00)"
            shadow={S.orange}
            title="Detection Timeline"
            subtitle="Exceptions found per run"
            footer={`Last run: ${stats?.last_run ? stats.last_run.slice(0, 10) : 'N/A'}`}
            headerHeight={180}
          >
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#fff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#fff" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="exceptions"
                    stroke="#fff"
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={false}
                  />
                  <XAxis dataKey="date" tick={{ fill: '#fff', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <RTooltip content={<DarkTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                <TrendingUp sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>No detection runs yet</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Upload data to see timeline</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Status donut (red/pink card) */}
        <Grid item xs={12} md={3}>
          <ChartCard
            color="linear-gradient(195deg, #EF5350, #C62828)"
            shadow={S.red}
            title="Exception Status"
            subtitle="Review progress"
            footer={stats?.ledger_exceptions ? `${stats.ledger_exceptions.toLocaleString()} total exceptions` : `${ledger.length} total exceptions`}
            headerHeight={180}
          >
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} opacity={0.9} />
                    ))}
                  </Pie>
                  <RTooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                <DonutLarge sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>No status data</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Upload data to view progress</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Chart cards row 2: Reason Codes + Top Outlier Vendors ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <WhiteChartCard
            title="Active Anomaly Drivers"
            subtitle={stats?.ledger_exceptions ? `Frequency of risk indicators across all ${stats.ledger_exceptions.toLocaleString()} flagged exceptions (records can trigger multiple tests).` : "Frequency of risk indicators across exceptions (records can trigger multiple tests)."}
            footer={reasonCodeCounts.length > 0 ? "Indicates the most active risk/fraud vectors in the transaction ledger" : "Upload data to generate analysis"}
            height={200}
          >
            {reasonCodeCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reasonCodeCounts}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 9 }} stroke="#cbd5e1" width={110} />
                  <RTooltip content={<DarkTooltip />} />
                  <Bar dataKey="count" fill="#9c27b0" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
                <Assessment sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#999' }}>No anomaly data</Typography>
                <Typography variant="caption" sx={{ color: '#bbb', fontSize: '0.65rem' }}>Upload a CSV to view analysis</Typography>
              </Box>
            )}
          </WhiteChartCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <WhiteChartCard
            title="Outlier Spend Analysis by Vendor"
            subtitle={stats?.ledger_exceptions ? `Cumulative transactional amount flagged across all ${stats.ledger_exceptions.toLocaleString()} exceptions.` : "Cumulative transactional amount flagged across exceptions."}
            footer={topVendorAnomalies.length > 0 ? "Highlights vendors with high-value anomalies needing prioritization" : "Upload data to generate analysis"}
            height={200}
          >
            {topVendorAnomalies.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendorAnomalies}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
                  <YAxis tickFormatter={v => typeof v === 'number' ? formatCurrency(v, DEFAULTS.CURRENCY).replace(/\.00$/, '') : v} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <RTooltip content={<DarkTooltip />} />
                  <Bar dataKey="amount" fill="#f44336" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
                <WarningAmber sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#999' }}>No vendor anomalies</Typography>
                <Typography variant="caption" sx={{ color: '#bbb', fontSize: '0.65rem' }}>Upload a CSV to view vendors</Typography>
              </Box>
            )}
          </WhiteChartCard>
        </Grid>
      </Grid>

      {/* ── Bottom row: top exceptions table + precision/recall ─── */}
      <Grid container spacing={3}>
        {/* Top exceptions mini-table */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', flexGrow: 1 }}>
                  Top Flagged Exceptions
                </Typography>
                <Chip label={`${(Array.isArray(ledger) ? ledger : []).filter(e => e.ensemble_score >= THRESHOLDS.CRITICAL_RISK).length} Critical`} color="error" size="small" />
              </Box>
              {(Array.isArray(ledger) ? ledger : []).slice(0, 6).map((ex, i) => (
                <Box key={ex.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        bgcolor: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2',
                      }}
                    />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#3c4858', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ex.vendor}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#999' }}>
                        {ex.invoice_number} · {ex.date}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#3c4858', flexShrink: 0 }}>
                      {formatCurrency(ex.amount, ex.currency)}
                    </Typography>
                    <Box sx={{ minWidth: 80, textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2' }}>
                          {((ex.ensemble_score ?? 0) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#666', fontSize: '0.65rem' }}>
                        {(ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? 'Critical' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? 'High' : 'Medium'}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(ex.ensemble_score ?? 0) * 100}
                        sx={{
                          height: 4, borderRadius: 2, mt: 0.3,
                          bgcolor: '#f5f5f5',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2',
                          },
                        }}
                      />
                    </Box>
                  </Box>
                  {i < 5 && <Divider />}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance metrics card */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                Detection Performance
              </Typography>
              {[
                { label: 'Precision',  value: stats?.precision || 0,  color: '#4caf50',  pct: Math.round((stats?.precision || 0) * 100)  },
                { label: 'Recall',     value: stats?.recall || 0,     color: '#2196f3',  pct: Math.round((stats?.recall || 0) * 100)     },
                { label: 'F1 Score',   value: stats?.f1_score || 0,   color: '#9c27b0',  pct: Math.round((stats?.f1_score || 0) * 100)   },
                { label: 'FP Reduction', value: (stats?.fp_reduction_pct || 0) / 100, color: '#ff9800', pct: stats?.fp_reduction_pct != null ? Math.round(stats.fp_reduction_pct * 10) / 10 : 0, suffix: '%' },
              ].map(({ label, value, color, pct, suffix }) => (
                <Box key={label} sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#3c4858' }}>{label}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color }}>
                      {suffix ? `${pct}${suffix}` : `${pct}%`}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, pct))}
                    sx={{
                      height: 6, borderRadius: 3,
                      bgcolor: '#f5f5f5',
                      '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                    }}
                  />
                </Box>
              ))}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['3-Way Match', "Benford's Law", 'Isolation Forest', 'Duplicate Invoices'].map(src => (
                  <Chip key={src} label={src} size="small" variant="outlined" sx={{ fontSize: '0.68rem', color: '#555', fontWeight: 500 }} />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: '#888', mt: 1, display: 'block', fontStyle: 'italic' }}>
                Ensemble model evaluated vs baseline at 0.50 operational threshold
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Marked Transactions Modal Dialog ───────────────────────── */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  bgcolor: modalConfig.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                {modalConfig.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>
                  {modalConfig.title} ({modalItems.length})
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {modalConfig.description}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setModalOpen(false)} size="small" sx={{ color: '#94a3b8' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {modalLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <CircularProgress size={36} color="primary" />
              <Typography variant="caption" sx={{ mt: 2, color: '#64748b' }}>Loading marked transactions...</Typography>
            </Box>
          ) : modalItems.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#475569' }}>
                No transactions found
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                There are currently no transactions marked with this status in the database.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: '0.78rem', color: '#475569' } }}>
                    <TableCell>ID</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Risk Score</TableCell>
                    <TableCell>Primary Trigger</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {modalItems.map((row) => (
                    <TableRow key={row.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                        #{row.id}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                        {row.vendor}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace' }}>
                        {row.invoice_number}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(row.amount, row.currency)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {row.date || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${Math.round((row.ensemble_score ?? 0) * 100)}%`}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            bgcolor: (row.ensemble_score ?? 0) >= 0.75 ? '#fee2e2' : (row.ensemble_score ?? 0) >= 0.5 ? '#fef3c7' : '#e0f2fe',
                            color: (row.ensemble_score ?? 0) >= 0.75 ? '#dc2626' : (row.ensemble_score ?? 0) >= 0.5 ? '#d97706' : '#0284c7',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', color: '#475569', maxWidth: 200 }}>
                        {row.reasons && row.reasons[0] ? (
                          <Tooltip title={row.reasons.map(r => r.label || r.code).join(' · ')}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {formatReasonLabel(row.reasons[0].label || row.reasons[0].code)}
                              {row.reasons.length > 1 && ` (+${row.reasons.length - 1})`}
                            </Typography>
                          </Tooltip>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={row.status} />
                      </TableCell>
                      <TableCell align="center">
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={row.status}
                            disabled={modalUpdatingId === row.id}
                            onChange={(e) => handleStatusChangeInModal(row.id, e.target.value)}
                            sx={{ fontSize: '0.75rem', height: 28 }}
                          >
                            <MenuItem value="confirmed" sx={{ fontSize: '0.75rem' }}>Confirmed</MenuItem>
                            <MenuItem value="false_positive" sx={{ fontSize: '0.75rem' }}>False Positive</MenuItem>
                            <MenuItem value="needs_review" sx={{ fontSize: '0.75rem' }}>Needs Review</MenuItem>
                            <MenuItem value="unreviewed" sx={{ fontSize: '0.75rem' }}>Unreviewed</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button
            size="small"
            variant="outlined"
            component={Link}
            to={modalConfig.filterParam ? `/ledger?status=${modalConfig.filterParam}` : '/ledger'}
            onClick={() => setModalOpen(false)}
            endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
          >
            Open in Full Exceptions Table
          </Button>
          <Button
            size="small"
            onClick={() => setModalOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
