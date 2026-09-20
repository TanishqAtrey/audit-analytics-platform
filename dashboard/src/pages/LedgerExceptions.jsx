import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Slider, TextField,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Collapse, Divider, LinearProgress, CircularProgress,
  Button, Tooltip, Stack, Alert, Slide, Pagination,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import { Download, KeyboardArrowDown, KeyboardArrowUp, Search, Assessment, Security } from '@mui/icons-material'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Cell,
  ScatterChart, Scatter, Label, ReferenceLine,
} from 'recharts'

import { getLedgerExceptions, getBenfordAnalysis, updateExceptionStatus, getSummaryStats } from '../api/client'
import { Link, useSearchParams } from 'react-router-dom'
import { StatusChip, SeverityChip } from '../components/StatusChip'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { formatCurrency, formatCompactCurrency } from '../utils/formatters'
import { DEFAULTS, THRESHOLDS } from '../config/constants'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2 }}>
      <Typography variant="caption" fontWeight={700}>{label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mt: 0.3 }}>
          <Box sx={{ borderRadius: '50%', bgcolor: p.color, width: 8, height: 8, mt: '3px', flexShrink: 0 }} />
          <Typography variant="caption">{p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</b></Typography>
        </Box>
      ))}
    </Box>
  )
}

function LedgerScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const score = d.ensemble_score ?? 0
  const scoreColor = score >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : score >= THRESHOLDS.MEDIUM_RISK ? '#f57c00' : '#1976d2'
  const riskTier = score >= THRESHOLDS.CRITICAL_RISK ? 'Critical Risk' : score >= THRESHOLDS.MEDIUM_RISK ? 'High Risk' : 'Moderate / Low'

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', fontSize: '0.78rem', minWidth: 210 }}>
      <Typography variant="caption" fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.84rem', display: 'block' }}>
        {d.vendor}
      </Typography>
      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.8 }}>
        Invoice #{d.invoice_number} · {d.date || 'N/A'}
      </Typography>
      <Divider sx={{ my: 0.8, borderColor: '#f1f5f9' }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Invoice Amount:</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {formatCurrency(d.rawAmount ?? d.amount, d.currency || DEFAULTS.CURRENCY)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Risk Score:</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: scoreColor }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: scoreColor }}>
            {(score * 100).toFixed(1)}% ({riskTier})
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

function ExceptionRow({ ex, onStatusSave }) {
  const [open, setOpen]     = useState(false)
  const [status, setStatus] = useState(ex.status)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateExceptionStatus(ex.id, status)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onStatusSave?.(ex.id, status)
  }

  return (
    <>
      <TableRow
        sx={{
          cursor: 'pointer',
          '&:hover': { bgcolor: '#fafafa' },
           borderLeft: `4px solid ${(ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2'}`,
        }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell sx={{ py: 1 }}>
          <IconButton size="small" aria-label={open ? "Collapse row" : "Expand row"}>{open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}</IconButton>
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 600, fontSize: '0.82rem', color: '#3c4858' }}>
          {ex.vendor}
        </TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.78rem', color: '#666' }}>{ex.invoice_number}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.82rem', fontWeight: 600 }}>{formatCurrency(ex.amount, ex.currency)}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.78rem', color: '#666' }}>{ex.date}</TableCell>
        <TableCell sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00', minWidth: 36 }}>
              {((ex.ensemble_score ?? 0) * 100).toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(ex.ensemble_score ?? 0) * 100}
              sx={{
                width: 60, height: 5, borderRadius: 2,
                bgcolor: '#f5f5f5',
                '& .MuiLinearProgress-bar': {
                  bgcolor: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2',
                },
              }}
            />
          </Box>
        </TableCell>
        <TableCell sx={{ py: 1 }}><SeverityChip score={ex.ensemble_score} /></TableCell>
        <TableCell sx={{ py: 1 }}><StatusChip status={ex.status} /></TableCell>
      </TableRow>

      {/* Expandable detail row */}
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: '#fafafa', p: 2, borderBottom: '1px solid #f0f0f0' }}>
              <Grid container spacing={3} alignItems="flex-start">
                {/* Reason codes */}
                <Grid item xs={12} md={7}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', mb: 1, display: 'block' }}>
                    Why Flagged
                  </Typography>
                  <Grid container spacing={1} alignItems="stretch">
                    {ex.reasons.map(rc => (
                      <Grid item key={rc.code} xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
                        <Box sx={{
                          bgcolor: '#fff',
                          border: '1px solid #eee',
                          borderRadius: 2,
                          p: 1.25,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1, fontSize: '0.72rem', lineHeight: 1.35 }}>
                            {rc.label}
                          </Typography>
                          <Box sx={{ mt: 'auto', pt: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : (rc.weight ?? 0) > 0.4 ? '#f57c00' : '#1976d2', fontSize: '0.95rem' }}>
                              {(rc.weight ?? 0).toFixed(2)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(rc.weight ?? 0) * 100}
                              sx={{
                                height: 3, borderRadius: 2, mt: 0.5,
                                bgcolor: '#f5f5f5',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : (rc.weight ?? 0) > 0.4 ? '#f57c00' : '#1976d2',
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>

                {/* Status control */}
                <Grid item xs={12} md={5}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', mb: 1, display: 'block' }}>
                    Update Status
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <Select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        sx={{ fontSize: '0.82rem' }}
                      >
                        {['unreviewed', 'confirmed', 'false_positive', 'needs_review'].map(s => (
                          <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                            {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSave}
                      disabled={saving}
                      sx={{ bgcolor: saved ? '#4caf50' : undefined, textTransform: 'none', fontSize: '0.8rem' }}
                    >
                      {saving ? <CircularProgress size={14} color="inherit" /> : saved ? 'Saved' : 'Save'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default function LedgerExceptions() {
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const initialThreshold = searchParams.get('threshold') ? parseFloat(searchParams.get('threshold')) : 0.0

  const [exceptions, setExceptions] = useState([])
  const [threshold,  setThreshold]  = useState(initialThreshold)
  const [benford,    setBenford]     = useState(null)
  const [loading,    setLoading]     = useState(true)
  const [sortBy,     setSortBy]      = useState('score_desc')
  const [statusFilter, setStatusFilter] = useState(initialStatus ? [initialStatus] : [])
  const [search,     setSearch]      = useState('')
  const [useLogScale, setUseLogScale] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [totalDbExceptions, setTotalDbExceptions] = useState(null)
  const [totalFilteredExceptions, setTotalFilteredExceptions] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  const [debouncedThreshold, setDebouncedThreshold] = useState(initialThreshold)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedThreshold(threshold)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [threshold])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const offset = (page - 1) * pageSize
    const activeStatus = statusFilter.length === 1 ? statusFilter[0] : null
    Promise.all([
      getLedgerExceptions(debouncedThreshold, pageSize, offset, sortBy, activeStatus),
      getBenfordAnalysis('ledger'),
      getSummaryStats()
    ]).then(([ex, b, s]) => {
      if (mounted) {
        setExceptions(ex)
        setBenford(b)
        const dbTotal = s?.ledger_exceptions ?? 0
        setTotalDbExceptions(dbTotal)
        setTotalFilteredExceptions(ex.total != null ? ex.total : dbTotal)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [debouncedThreshold, page, pageSize, sortBy, statusFilter])

  useEffect(() => {
    if (!loading && exceptions.length === 0) {
      const timer = setTimeout(() => setShowBanner(true), 150)
      return () => clearTimeout(timer)
    } else {
      setShowBanner(false)
    }
  }, [loading, exceptions.length])

  const filtered = useMemo(() => {
    let list = Array.isArray(exceptions) ? [...exceptions] : []
    if (statusFilter.length) list = list.filter(e => statusFilter.includes(e.status))
    if (search.trim()) {
      const t = search.toLowerCase()
      list = list.filter(e => e.vendor?.toLowerCase().includes(t) || e.invoice_number?.toLowerCase().includes(t))
    }
    return list
  }, [exceptions, statusFilter, search])

  const handleHeaderSort = (columnKey) => {
    setPage(1)
    if (sortBy === `${columnKey}_desc`) {
      setSortBy(`${columnKey}_asc`)
    } else {
      setSortBy(`${columnKey}_desc`)
    }
  }

  const benfordData = benford
    ? Array.from({ length: 9 }, (_, i) => ({
        digit: String(i + 1),
        Expected: +(benford.expected[i + 1] * 100).toFixed(2),
        Observed: +(benford.observed[i + 1] * 100).toFixed(2),
      }))
    : []

  const scoreData = Array.from({ length: 10 }, (_, i) => {
    const min = i / 10, max = (i + 1) / 10
    return { range: `${(min * 100).toFixed(0)}–${(max * 100).toFixed(0)}`, count: exceptions.filter(e => e.ensemble_score >= min && e.ensemble_score < max).length }
  })

  const { scatterData, scatterYDomain, scatterYTicks } = useMemo(() => {
    if (!filtered || filtered.length === 0) {
      return { scatterData: [], scatterYDomain: [0, 100], scatterYTicks: [0, 50, 100] }
    }

    const amounts = filtered.map(e => Math.max(1, Number(e.amount) || 0))
    const minAmt = Math.min(...amounts)
    const maxAmt = Math.max(...amounts)

    if (useLogScale) {
      const minExp = Math.max(0, Math.floor(Math.log10(minAmt)))
      const maxExp = Math.max(minExp + 1, Math.ceil(Math.log10(maxAmt)))

      const ticks = []
      for (let exp = minExp; exp <= maxExp; exp++) {
        ticks.push(exp)
      }

      const data = filtered.map(e => {
        const amt = Math.max(1, Number(e.amount) || 0)
        return {
          ...e,
          x: Number(e.ensemble_score) || 0,
          y: Math.log10(amt),
          rawAmount: amt,
        }
      })

      return {
        scatterData: data,
        scatterYDomain: [minExp, maxExp],
        scatterYTicks: ticks,
      }
    } else {
      const padMax = maxAmt > 0 ? Math.ceil((maxAmt * 1.08) / 1000) * 1000 : 10000
      const data = filtered.map(e => {
        const amt = Math.max(0, Number(e.amount) || 0)
        return {
          ...e,
          x: Number(e.ensemble_score) || 0,
          y: amt,
          rawAmount: amt,
        }
      })

      return {
        scatterData: data,
        scatterYDomain: [0, padMax],
        scatterYTicks: undefined,
      }
    }
  }, [filtered, useLogScale])

  const formatYTick = (v) => {
    if (useLogScale) {
      const amt = Math.round(Math.pow(10, v))
      return formatCompactCurrency(amt, DEFAULTS.CURRENCY)
    }
    return formatCompactCurrency(v, DEFAULTS.CURRENCY)
  }

  const handleExport = () => {
    const esc = s => `"${String(s || '').replace(/"/g, '""')}"`
    const rows = filtered.map(e => `${e.id},${esc(e.vendor)},${esc(e.invoice_number)},${e.amount},${esc(e.date)},${e.ensemble_score},${e.status}`)
    const csv  = `id,vendor,invoice_number,amount,date,ensemble_score,status\n${rows.join('\n')}`
    const a    = document.createElement('a'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.href = url; a.download = 'ledger_exceptions.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Empty State Banner — slides in from the right */}
      {!loading && exceptions.length === 0 && (
        <Slide direction="left" in={showBanner} mountOnEnter unmountOnExit timeout={400}>
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
                to="/upload?tab=ledger"
                sx={{ textTransform: 'none', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600, mt: 0.5 }}
              >
                Go to Upload Data →
              </Button>
            }
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No Ledger Data Available</Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
              Upload a CSV ledger dataset in the Data Ingestion Portal to begin fraud detection and anomaly analysis.
            </Typography>
          </Alert>
        </Slide>
      )}

      {/* Chart cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={5}>
          <ChartCard
            color="linear-gradient(195deg, #66BB6A, #388E3C)"
            shadow="0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(76,175,80,.4)"
            title="Benford's Law — Leading Digit Distribution"
            subtitle={benford ? `MAD: ${benford.mad.toFixed(4)} · p-value: ${benford.chi2_p < 0.001 ? '< 0.001' : benford.chi2_p.toFixed(3)} (${benford.chi2_p < 0.05 ? 'Suspicious' : 'Normal'})` : 'Awaiting data'}
            footer={benford ? (benford.chi2_p < 0.05 ? "Significant deviation flags potential manipulation (p < 0.05)" : "Conforms to standard Benford distribution") : "Upload data to generate analysis"}
            headerHeight={200}
          >
            {benford && benfordData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benfordData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <Bar dataKey="Expected" fill="rgba(255,255,255,0.3)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Observed" fill="rgba(255,255,255,0.9)" radius={[2, 2, 0, 0]} />
                  <XAxis dataKey="digit" tick={{ fill: '#fff', fontSize: 11 }} axisLine={false} tickLine={false} />
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
        <Grid item xs={12} md={7}>
          <ChartCard
            color="linear-gradient(195deg, #EF5350, #C62828)"
            shadow="0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(244,67,54,.4)"
            title="Score Distribution"
            subtitle={
              totalFilteredExceptions != null
                ? `${totalFilteredExceptions.toLocaleString()} exceptions ${threshold > 0 ? `above threshold ${threshold.toFixed(2)}` : 'across all risk tiers'}${totalDbExceptions ? ` (${totalDbExceptions.toLocaleString()} total in database)` : ''}`
                : 'Awaiting data'
            }
            footer={
              threshold > 0
                ? `Filtered at threshold: ${threshold.toFixed(2)} · Showing ${totalFilteredExceptions?.toLocaleString() ?? 0} of ${totalDbExceptions?.toLocaleString() ?? 0}`
                : `Showing all ${totalDbExceptions ? totalDbExceptions.toLocaleString() : '5,300'} exceptions in database`
            }
            headerHeight={200}
          >
            {exceptions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <Bar dataKey="count" fill="rgba(255,255,255,0.85)" radius={[2, 2, 0, 0]} />
                  <XAxis dataKey="range" tick={{ fill: '#fff', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <RTooltip content={<DarkTooltip />} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                <Security sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>No exceptions</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Upload data first</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Exceptions Spotlight Scatter Chart */}
      <Box sx={{ mb: 4 }}>
        <WhiteChartCard
          title="Exceptions Spotlight — Transaction Amount vs Risk Score"
          subtitle="Interactive scatter matrix: X-axis shows AI risk probability (0–100%), Y-axis displays invoice amount. High risk & high value entries (top-right) require immediate audit sampling."
          footer={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#d32f2f' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Critical Risk (≥ 80%)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#f57c00' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>High Risk (50%–79%)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#1976d2' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Moderate / Low (&lt; 50%)</Typography>
                </Box>
              </Stack>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.72rem' }}>
                Tip: Click any point to filter the ledger table below
              </Typography>
            </Box>
          }
          height={350}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
              Displaying <strong>{scatterData.length}</strong> flagged transactions in spotlight
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>
                Y-Axis Scale:
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={useLogScale ? 'log' : 'linear'}
                exclusive
                onChange={(e, val) => { if (val !== null) setUseLogScale(val === 'log') }}
                sx={{
                  height: 28,
                  '& .MuiToggleButton-root': {
                    px: 1.5,
                    py: 0.2,
                    fontSize: '0.72rem',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: '#e2e8f0',
                    '&.Mui-selected': {
                      bgcolor: '#4338ca',
                      color: '#ffffff',
                      '&:hover': { bgcolor: '#3730a3' },
                    },
                  },
                }}
              >
                <ToggleButton value="linear">Linear</ToggleButton>
                <ToggleButton value="log">Logarithmic</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>
          {exceptions.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 25, right: 30, left: 25, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Risk Score"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                  tickFormatter={v => `${(v*100).toFixed(0)}%`}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                >
                  <Label value="Ensemble Risk Score →" position="bottom" offset={12} style={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Amount"
                  domain={scatterYDomain}
                  ticks={scatterYTicks}
                  width={80}
                  tickFormatter={formatYTick}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                >
                  <Label
                    value={useLogScale ? "Invoice Amount (Log Scale)" : "Invoice Amount"}
                    angle={-90}
                    position="insideLeft"
                    offset={12}
                    style={{ textAnchor: 'middle', fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                </YAxis>
                <ReferenceLine x={THRESHOLDS.CRITICAL_RISK} stroke="#d32f2f" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Critical (${THRESHOLDS.CRITICAL_RISK * 100}%)`, position: "top", fill: "#d32f2f", fontSize: 10, fontWeight: 700 }} />
                <ReferenceLine x={THRESHOLDS.MEDIUM_RISK} stroke="#f57c00" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `High (${THRESHOLDS.MEDIUM_RISK * 100}%)`, position: "top", fill: "#f57c00", fontSize: 10, fontWeight: 700 }} />
                <RTooltip content={<LedgerScatterTooltip />} />
                <Scatter
                  data={scatterData}
                  shape="circle"
                  cursor="pointer"
                  onClick={(entry) => {
                    if (entry?.invoice_number) setSearch(entry.invoice_number)
                  }}
                >
                  {scatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={(entry.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (entry.ensemble_score ?? 0) >= THRESHOLDS.MEDIUM_RISK ? '#f57c00' : '#1976d2'}
                      fillOpacity={0.75}
                      stroke="#ffffff"
                      strokeWidth={1}
                      r={Math.max(4.5, Math.min(8.5, (entry.ensemble_score ?? 0) * 8))}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, color: '#ccc' }}>
              <Assessment sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#999' }}>No exceptions to display</Typography>
              <Typography variant="caption" sx={{ color: '#bbb', fontSize: '0.75rem' }}>Upload a CSV ledger in Data Ingestion Portal to view risk vs amount scatter matrix</Typography>
            </Box>
          )}
        </WhiteChartCard>
      </Box>

      {/* Controls + table */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
        <CardContent>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                Ledger Exceptions
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                {(totalFilteredExceptions ?? totalDbExceptions) > 0 ? (
                  threshold > 0 || statusFilter.length > 0 ? (
                    <>Showing <strong>{Math.min((page - 1) * pageSize + 1, totalFilteredExceptions ?? totalDbExceptions)}–{Math.min((page - 1) * pageSize + filtered.length, totalFilteredExceptions ?? totalDbExceptions)}</strong> of <strong>{(totalFilteredExceptions ?? totalDbExceptions).toLocaleString()}</strong> filtered exceptions {totalDbExceptions ? <>(of <strong>{totalDbExceptions.toLocaleString()}</strong> total in database)</> : null} (Page {page} of {Math.max(1, Math.ceil((totalFilteredExceptions ?? totalDbExceptions) / pageSize))})</>
                  ) : (
                    <>Showing <strong>{Math.min((page - 1) * pageSize + 1, totalFilteredExceptions ?? totalDbExceptions)}–{Math.min((page - 1) * pageSize + filtered.length, totalFilteredExceptions ?? totalDbExceptions)}</strong> of <strong>{(totalFilteredExceptions ?? totalDbExceptions).toLocaleString()}</strong> total exceptions in database (Page {page} of {Math.max(1, Math.ceil((totalFilteredExceptions ?? totalDbExceptions) / pageSize))})</>
                  )
                ) : (
                  <>Showing {filtered.length} exceptions</>
                )} · Click table headers or use dropdown to sort
              </Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleExport} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
              Export CSV
            </Button>
          </Box>

          {/* Filter row */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', display: 'block' }}>
                    Risk Threshold: <strong style={{ color: '#3c4858' }}>{threshold > 0 ? `≥ ${threshold.toFixed(2)}` : 'All (0.00)'}</strong>
                  </Typography>
                  {threshold > 0 && (
                    <Button
                      size="small"
                      onClick={() => setThreshold(0.0)}
                      sx={{ p: 0, minWidth: 0, fontSize: '0.7rem', textTransform: 'none', color: '#6366f1', fontWeight: 600 }}
                    >
                      Show All {totalDbExceptions ? `(${totalDbExceptions.toLocaleString()})` : ''}
                    </Button>
                  )}
                </Box>
                <Slider
                  value={threshold}
                  onChange={(_, v) => setThreshold(v)}
                  min={0} max={1} step={0.05}
                  color="secondary"
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                size="small"
                fullWidth
                label="Search vendor / invoice"
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: '#bbb', mr: 0.5 }} /> }}
                sx={{ '& .MuiInputLabel-root': { fontSize: '0.82rem' } }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Filter Status</InputLabel>
                <Select
                  multiple
                  value={statusFilter}
                  onChange={e => { setPage(1); setStatusFilter(e.target.value) }}
                  input={<OutlinedInput label="Filter Status" />}
                  renderValue={(sel) => sel.map(s => s.replace('_', ' ')).join(', ')}
                  sx={{ fontSize: '0.82rem' }}
                >
                  {['unreviewed', 'confirmed', 'false_positive', 'needs_review'].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                      {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Sort By</InputLabel>
                <Select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} label="Sort By" sx={{ fontSize: '0.82rem' }}>
                  <MenuItem value="score_desc"  sx={{ fontSize: '0.82rem' }}>Score ↓ (Highest First)</MenuItem>
                  <MenuItem value="score_asc"   sx={{ fontSize: '0.82rem' }}>Score ↑ (Lowest First)</MenuItem>
                  <MenuItem value="amount_desc" sx={{ fontSize: '0.82rem' }}>Amount ↓ (Highest First)</MenuItem>
                  <MenuItem value="amount_asc"  sx={{ fontSize: '0.82rem' }}>Amount ↑ (Lowest First)</MenuItem>
                  <MenuItem value="invoice_asc" sx={{ fontSize: '0.82rem' }}>Invoice # (A → Z)</MenuItem>
                  <MenuItem value="invoice_desc" sx={{ fontSize: '0.82rem' }}>Invoice # (Z → A)</MenuItem>
                  <MenuItem value="vendor_asc"  sx={{ fontSize: '0.82rem' }}>Vendor (A → Z)</MenuItem>
                  <MenuItem value="vendor_desc" sx={{ fontSize: '0.82rem' }}>Vendor (Z → A)</MenuItem>
                  <MenuItem value="date_desc"   sx={{ fontSize: '0.82rem' }}>Date ↓ (Newest First)</MenuItem>
                  <MenuItem value="date_asc"    sx={{ fontSize: '0.82rem' }}>Date ↑ (Oldest First)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress color="secondary" />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', py: 1.5, userSelect: 'none' } }}>
                    <TableCell width={40} />
                    <TableCell
                      onClick={() => handleHeaderSort('vendor')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Vendor {sortBy === 'vendor_desc' ? '↓' : sortBy === 'vendor_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('invoice')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Invoice # {sortBy === 'invoice_desc' ? '↓' : sortBy === 'invoice_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('amount')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Amount {sortBy === 'amount_desc' ? '↓' : sortBy === 'amount_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('date')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Date {sortBy === 'date_desc' ? '↓' : sortBy === 'date_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('score')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Score {sortBy === 'score_desc' ? '↓' : sortBy === 'score_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: '#999' }}>
                        No exceptions match the current filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(ex => (
                      <ExceptionRow
                        key={ex.id}
                        ex={ex}
                        onStatusSave={(id, s) => setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: s } : e))}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Server-side Pagination controls */}
          {(totalFilteredExceptions ?? totalDbExceptions) > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                pt: 2.5,
                pb: 1,
                px: 1,
                borderTop: '1px solid #f0f0f0',
                mt: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 500 }}>
                Page <strong>{page}</strong> of <strong>{Math.max(1, Math.ceil((totalFilteredExceptions ?? totalDbExceptions) / pageSize))}</strong> · Showing <strong>{Math.min((page - 1) * pageSize + 1, (totalFilteredExceptions ?? totalDbExceptions))}–{Math.min((page - 1) * pageSize + filtered.length, (totalFilteredExceptions ?? totalDbExceptions))}</strong> of <strong>{(totalFilteredExceptions ?? totalDbExceptions).toLocaleString()}</strong> {threshold > 0 || statusFilter.length > 0 ? 'filtered ' : ''}exceptions {threshold > 0 || statusFilter.length > 0 ? (totalDbExceptions ? `(${totalDbExceptions.toLocaleString()} total in database)` : '') : ''}
              </Typography>
              <Pagination
                count={Math.max(1, Math.ceil((totalFilteredExceptions ?? totalDbExceptions) / pageSize))}
                page={page}
                onChange={(_, newPage) => {
                  setPage(newPage)
                  window.scrollTo({ top: 380, behavior: 'smooth' })
                }}
                color="secondary"
                shape="rounded"
                showFirstButton
                showLastButton
                size="medium"
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

