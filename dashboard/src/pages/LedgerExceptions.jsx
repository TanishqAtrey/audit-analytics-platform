import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Slider, TextField,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Collapse, Divider, LinearProgress, CircularProgress,
  Button, Tooltip, Stack, Alert, Slide,
} from '@mui/material'
import { Download, KeyboardArrowDown, KeyboardArrowUp, Search } from '@mui/icons-material'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Cell,
  ScatterChart, Scatter, Label, ReferenceLine,
} from 'recharts'

import { getLedgerExceptions, getBenfordAnalysis, updateExceptionStatus } from '../api/client'
import { Link } from 'react-router-dom'
import { StatusChip, SeverityChip } from '../components/StatusChip'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { formatCurrency } from '../utils/formatters'
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
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2, fontSize: '0.78rem' }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.vendor}</Typography>
      <Typography variant="caption" display="block" color="text.secondary">Inv: {d.invoice_number} · Date: {d.date}</Typography>
      <Box sx={{ mt: 0.5 }}>
        <span style={{ color: '#3c4858', fontWeight: 700 }}>Amount: {formatCurrency(d.amount, d.currency)}</span>
      </Box>
      <Box>
        <span style={{ color: '#9c27b0', fontWeight: 700 }}>Ensemble Risk: {((d.ensemble_score ?? 0) * 100).toFixed(1)}%</span>
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
                  <Grid container spacing={1}>
                    {ex.reasons.map(rc => (
                      <Grid item key={rc.code} xs={6} sm={4} md={3}>
                        <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                            {rc.label}
                          </Typography>
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
  const [exceptions, setExceptions] = useState([])
  const [threshold,  setThreshold]  = useState(0.5)
  const [benford,    setBenford]     = useState(null)
  const [loading,    setLoading]     = useState(true)
  const [sortBy,     setSortBy]      = useState('score_desc')
  const [statusFilter, setStatusFilter] = useState([])
  const [search,     setSearch]      = useState('')
  const [useLogScale, setUseLogScale] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  const [debouncedThreshold, setDebouncedThreshold] = useState(0.5)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedThreshold(threshold), 400)
    return () => clearTimeout(timer)
  }, [threshold])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([getLedgerExceptions(debouncedThreshold), getBenfordAnalysis('ledger')]).then(([ex, b]) => {
      if (mounted) { setExceptions(ex); setBenford(b); setLoading(false) }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [debouncedThreshold])

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
    
    // Multi-column sorting
    switch (sortBy) {
      case 'score_desc':
        list.sort((a, b) => (b.ensemble_score ?? 0) - (a.ensemble_score ?? 0))
        break
      case 'score_asc':
        list.sort((a, b) => (a.ensemble_score ?? 0) - (b.ensemble_score ?? 0))
        break
      case 'amount_desc':
        list.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
        break
      case 'amount_asc':
        list.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))
        break
      case 'date_desc':
        list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        break
      case 'date_asc':
        list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
        break
      case 'vendor_asc':
        list.sort((a, b) => (a.vendor ?? '').localeCompare(b.vendor ?? ''))
        break
      case 'vendor_desc':
        list.sort((a, b) => (b.vendor ?? '').localeCompare(a.vendor ?? ''))
        break
      case 'invoice_asc':
        list.sort((a, b) => (a.invoice_number ?? '').localeCompare(b.invoice_number ?? ''))
        break
      case 'invoice_desc':
        list.sort((a, b) => (b.invoice_number ?? '').localeCompare(a.invoice_number ?? ''))
        break
      default:
        list.sort((a, b) => (b.ensemble_score ?? 0) - (a.ensemble_score ?? 0))
    }
    return list
  }, [exceptions, statusFilter, search, sortBy])

  const handleHeaderSort = (columnKey) => {
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

  const scatterData = useMemo(() => {
    return filtered.map((e, idx) => {
      const amt = Math.max(0.1, Number(e.amount) || 0)
      const yVal = useLogScale ? Math.log10(amt) : amt
      return {
        ...e,
        x: e.ensemble_score,
        y: yVal,
        rawAmount: amt,
        z: (e.ensemble_score ?? 0) * 12 + 4,
      }
    })
  }, [filtered, useLogScale])

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
            subtitle={benford ? `MAD: ${benford.mad.toFixed(4)} · p-value: ${benford.chi2_p.toFixed(3)} ${benford.chi2_p < 0.05 ? 'Suspicious' : 'Normal'}` : ''}
            footer="Red deviation flags potential manipulation"
            headerHeight={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benfordData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <Bar dataKey="Expected" fill="rgba(255,255,255,0.3)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Observed" fill="rgba(255,255,255,0.9)" radius={[2, 2, 0, 0]} />
                <XAxis dataKey="digit" tick={{ fill: '#fff', fontSize: 11 }} axisLine={false} tickLine={false} />
                <RTooltip content={<DarkTooltip />} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={7}>
          <ChartCard
            color="linear-gradient(195deg, #EF5350, #C62828)"
            shadow="0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(244,67,54,.4)"
            title="Score Distribution"
            subtitle={`${filtered.filter(e => e.ensemble_score >= threshold).length} exceptions above threshold ${threshold.toFixed(2)}`}
            footer={`Threshold: ${threshold.toFixed(2)}`}
            headerHeight={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <Bar dataKey="count" fill="rgba(255,255,255,0.85)" radius={[2, 2, 0, 0]} />
                <XAxis dataKey="range" tick={{ fill: '#fff', fontSize: 9 }} axisLine={false} tickLine={false} />
                <RTooltip content={<DarkTooltip />} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Exceptions Spotlight Scatter Chart */}
      <Box sx={{ mb: 4 }}>
        <WhiteChartCard
          title="Exceptions Spotlight — Transaction Amount vs Risk Score"
          subtitle="Interactive scatter matrix: X-axis shows AI risk probability (0–100%), Y-axis displays invoice amount. High risk & high value entries (top-right) require immediate audit sampling."
          footer="Critical (≥ 80%) · High Risk (50%–79%) · Moderate/Low (< 50%)"
          height={320}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, px: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Y-Axis Scale:
              </Typography>
              <Button
                size="small"
                variant={!useLogScale ? "contained" : "outlined"}
                onClick={() => setUseLogScale(false)}
                sx={{ py: 0.2, px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: 1.5 }}
              >
                Linear
              </Button>
              <Button
                size="small"
                variant={useLogScale ? "contained" : "outlined"}
                onClick={() => setUseLogScale(true)}
                color="secondary"
                sx={{ py: 0.2, px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: 1.5 }}
              >
                Balanced Log Scale (Spread Low Amounts)
              </Button>
            </Stack>
          </Box>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 20, right: 25, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="x"
                name="Risk Score"
                domain={[0, 1]}
                tickFormatter={v => `${(v*100).toFixed(0)}%`}
                tick={{ fill: '#64748b', fontSize: 10 }}
                stroke="#cbd5e1"
              >
                <Label value="Ensemble Risk Score →" position="bottom" offset={8} style={{ fill: '#334155', fontSize: 11, fontWeight: 600 }} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="y"
                name="Amount"
                tickFormatter={v => useLogScale ? `10^${v.toFixed(1)} (${formatCurrency(Math.round(Math.pow(10, v)), DEFAULTS.CURRENCY)})` : formatCurrency(v, DEFAULTS.CURRENCY)}
                tick={{ fill: '#64748b', fontSize: 10 }}
                stroke="#cbd5e1"
              >
                <Label
                  value={useLogScale ? "Invoice Amount (Log Scale)" : "Invoice Amount (Linear)"}
                  angle={-90}
                  position="insideLeft"
                  offset={-5}
                  style={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                />
              </YAxis>
              <ReferenceLine x={THRESHOLDS.CRITICAL_RISK} stroke="#d32f2f" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Critical (${THRESHOLDS.CRITICAL_RISK * 100}%)`, position: "top", fill: "#d32f2f", fontSize: 10, fontWeight: 700 }} />
              <ReferenceLine x={THRESHOLDS.MEDIUM_RISK} stroke="#f57c00" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `High (${THRESHOLDS.MEDIUM_RISK * 100}%)`, position: "top", fill: "#f57c00", fontSize: 10, fontWeight: 700 }} />
              <RTooltip content={<LedgerScatterTooltip />} />
              <Scatter data={scatterData} shape="circle">
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={(entry.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (entry.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2'}
                    fillOpacity={0.85}
                    r={entry.z}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
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
              <Typography variant="body2" sx={{ color: '#999', fontSize: '0.8rem' }}>
                {filtered.length} of {exceptions.length} results shown · Click table headers or use dropdown to sort
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
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', mb: 0.5, display: 'block' }}>
                  Threshold: <strong style={{ color: '#3c4858' }}>{threshold.toFixed(2)}</strong>
                </Typography>
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
                  onChange={e => setStatusFilter(e.target.value)}
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
                <Select value={sortBy} onChange={e => setSortBy(e.target.value)} label="Sort By" sx={{ fontSize: '0.82rem' }}>
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
        </CardContent>
      </Card>
    </Box>
  )
}

