import React, { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Box, Grid, Card, CardContent, Typography, Slider, TextField,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Collapse, Divider, LinearProgress, CircularProgress,
  Button, Tooltip, Stack, Alert, Slide, Pagination,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import {
  Download, KeyboardArrowDown, KeyboardArrowUp, Search,
  Assessment, Security, Refresh, WarningAmber,
} from '@mui/icons-material'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Cell,
  ScatterChart, Scatter, Label, ReferenceLine,
} from 'recharts'

import { getFsExceptions, updateExceptionStatus, getSummaryStats } from '../api/client'
import { StatusChip, SeverityChip } from '../components/StatusChip'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { THRESHOLDS, DEFAULTS } from '../config/constants'

/* ── Custom Recharts Tooltip for Dark Bar Charts ─────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2 }}>
      <Typography variant="caption" fontWeight={700} sx={{ color: '#1e293b' }}>{label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mt: 0.3, alignItems: 'center' }}>
          <Box sx={{ borderRadius: '50%', bgcolor: p.color || '#0284c7', width: 8, height: 8, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: '#475569' }}>
            {p.name}: <b>{typeof p.value === 'number' ? (p.value % 1 !== 0 ? p.value.toFixed(2) : p.value) : p.value}</b>
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

/* ── Custom Scatter Tooltip ───────────────────────────────────────── */
function FinancialScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const score = d.ensemble_score ?? 0
  const scoreColor = score >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : score >= THRESHOLDS.MEDIUM_RISK ? '#f57c00' : '#1976d2'
  const riskTier = score >= THRESHOLDS.CRITICAL_RISK ? 'Critical Risk' : score >= THRESHOLDS.MEDIUM_RISK ? 'High Risk' : 'Moderate / Safe'

  const mColor = d.m_score != null && d.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? '#d32f2f' : '#388e3c'
  const zColor = d.z_score != null && d.z_score < THRESHOLDS.Z_SCORE_GREY ? '#d32f2f' : d.z_score < THRESHOLDS.Z_SCORE_SAFE ? '#f57c00' : '#388e3c'
  const zZone = (d.altman_zone || (d.z_score < THRESHOLDS.Z_SCORE_GREY ? 'distress' : d.z_score <= THRESHOLDS.Z_SCORE_SAFE ? 'grey' : 'safe')).toUpperCase()

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', fontSize: '0.78rem', minWidth: 230 }}>
      <Typography variant="caption" fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.84rem', display: 'block' }}>
        {d.company} ({d.ticker})
      </Typography>
      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.8 }}>
        Fiscal Year {d.fiscal_year} · Status: {d.status?.replace('_', ' ')}
      </Typography>
      <Divider sx={{ my: 0.8, borderColor: '#f1f5f9' }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Beneish M-Score:</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: mColor }}>
          {d.m_score != null ? d.m_score.toFixed(2) : 'N/A'} {d.m_score != null && d.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? '(Manipulator)' : '(Clean)'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Altman Z-Score:</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: zColor }}>
          {d.z_score != null ? d.z_score.toFixed(2) : 'N/A'} ({zZone})
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Ensemble Risk:</Typography>
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

function FsRow({ ex, onStatusSave }) {
  const [open, setOpen]     = useState(false)
  const [status, setStatus] = useState(ex.status)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateExceptionStatus(ex.id, status)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onStatusSave?.(ex.id, status)
  }

  const mColor = ex.m_score != null && ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? '#d32f2f' : '#388e3c'
  const zColor = ex.z_score != null && ex.z_score < THRESHOLDS.Z_SCORE_GREY ? '#d32f2f' : ex.z_score < THRESHOLDS.Z_SCORE_SAFE ? '#f57c00' : '#388e3c'
  const borderCol = (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (ex.ensemble_score ?? 0) >= THRESHOLDS.MEDIUM_RISK ? '#f57c00' : '#1976d2'

  return (
    <>
      <TableRow
        sx={{
          cursor: 'pointer',
          '&:hover': { bgcolor: '#fafafa' },
          borderLeft: `4px solid ${borderCol}`,
        }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell sx={{ py: 1 }} width={40}>
          <IconButton size="small" aria-label={open ? "Collapse row" : "Expand row"}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, fontSize: '0.85rem', color: '#9c27b0' }}>
          {ex.ticker}
        </TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
          {ex.company}
        </TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.8rem', color: '#64748b' }}>
          FY {ex.fiscal_year}
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, color: mColor, fontSize: '0.85rem' }}>
          {ex.m_score != null ? ex.m_score.toFixed(2) : '—'}
          {ex.m_score != null && ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION && (
            <Chip label="Risk" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
          )}
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, color: zColor, fontSize: '0.85rem' }}>
          {ex.z_score != null ? ex.z_score.toFixed(2) : '—'}
          {ex.z_score != null && ex.z_score < THRESHOLDS.Z_SCORE_GREY && (
            <Chip label="Distress" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
          )}
        </TableCell>
        <TableCell sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: borderCol, minWidth: 36 }}>
              {((ex.ensemble_score ?? 0) * 100).toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(ex.ensemble_score ?? 0) * 100}
              sx={{
                width: 55, height: 5, borderRadius: 2,
                bgcolor: '#f1f5f9',
                '& .MuiLinearProgress-bar': { bgcolor: borderCol }
              }}
            />
          </Box>
        </TableCell>
        <TableCell sx={{ py: 1 }}><SeverityChip score={ex.ensemble_score} /></TableCell>
        <TableCell sx={{ py: 1 }}><StatusChip status={ex.status} /></TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: '#f8fafc', p: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              {/* Header Action Row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="#1e293b">
                    Forensic Analysis Dossier — {ex.ticker} ({ex.company}) FY{ex.fiscal_year}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Detailed breakdown of the 5 Altman Z-Score solvency ratios and 8 Beneish M-Score earnings manipulation indices.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select value={status} onChange={e => setStatus(e.target.value)} sx={{ fontSize: '0.82rem', bgcolor: '#fff' }}>
                      {['unreviewed', 'confirmed', 'false_positive', 'needs_review'].map(s => (
                        <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                          {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" size="small" onClick={handleSave} disabled={saving}
                    sx={{ bgcolor: saved ? '#4caf50' : undefined, textTransform: 'none', fontSize: '0.8rem', fontWeight: 700 }}>
                    {saving ? <CircularProgress size={14} color="inherit" /> : saved ? 'Saved' : 'Save Status'}
                  </Button>
                </Stack>
              </Box>

              <Grid container spacing={2}>
                {/* Altman Z-Score: 5 Ratios Panel */}
                <Grid item xs={12} md={5}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#fff', height: '100%' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', color: '#1e293b', fontSize: '0.78rem' }}>
                          Altman Z-Score (5 Ratios)
                        </Typography>
                        <Chip
                          label={`Z = ${typeof ex.z_score === 'number' ? ex.z_score.toFixed(2) : 'N/A'} · ${(ex.altman_zone || (ex.z_score < THRESHOLDS.Z_SCORE_GREY ? 'distress' : ex.z_score <= THRESHOLDS.Z_SCORE_SAFE ? 'grey' : 'safe')).toUpperCase()}`}
                          size="small"
                          color={ex.z_score < THRESHOLDS.Z_SCORE_GREY ? 'error' : ex.z_score <= THRESHOLDS.Z_SCORE_SAFE ? 'warning' : 'success'}
                          sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                      <Stack spacing={1}>
                        {[
                          { code: 'X1', label: 'Working Capital / Total Assets', val: ex.altman_ratios?.x1_wc_ta, desc: 'Short-term liquidity' },
                          { code: 'X2', label: 'Retained Earnings / Total Assets', val: ex.altman_ratios?.x2_re_ta, desc: 'Cumulative lifetime profit' },
                          { code: 'X3', label: 'EBIT / Total Assets', val: ex.altman_ratios?.x3_ebit_ta, desc: 'Operating productivity' },
                          { code: 'X4', label: 'Market Equity / Total Liabilities', val: ex.altman_ratios?.x4_mve_tl, desc: 'Insolvency cushion' },
                          { code: 'X5', label: 'Sales / Total Assets', val: ex.altman_ratios?.x5_sales_ta, desc: 'Asset turnover efficiency' },
                        ].map(item => (
                          <Box key={item.code} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block' }}>
                                <span style={{ color: '#0284c7', marginRight: 6 }}>{item.code}</span>{item.label}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                                {item.desc}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', ml: 1 }}>
                              {item.val != null ? Number(item.val).toFixed(3) : '—'}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Beneish M-Score: 8 Ratios Panel */}
                <Grid item xs={12} md={7}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#fff', height: '100%' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', color: '#1e293b', fontSize: '0.78rem' }}>
                          Beneish M-Score (8 Indices)
                        </Typography>
                        <Chip
                          label={`M = ${typeof ex.m_score === 'number' ? ex.m_score.toFixed(2) : 'N/A'} · ${typeof ex.m_score === 'number' && ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? 'HIGH MANIPULATION RISK' : 'CLEAN'}`}
                          size="small"
                          color={typeof ex.m_score === 'number' && ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? 'error' : 'success'}
                          sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                      <Grid container spacing={1}>
                        {[
                          { code: 'DSRI', name: 'Days Sales in Receivables', val: ex.beneish_ratios?.dsri, flag: (ex.beneish_ratios?.dsri ?? 0) > 1.0, hint: '> 1.0 (revenue inflation)' },
                          { code: 'GMI',  name: 'Gross Margin Index',       val: ex.beneish_ratios?.gmi,  flag: (ex.beneish_ratios?.gmi ?? 0) > 1.0,  hint: '> 1.0 (margin decay)' },
                          { code: 'AQI',  name: 'Asset Quality Index',       val: ex.beneish_ratios?.aqi,  flag: (ex.beneish_ratios?.aqi ?? 0) > 1.0,  hint: '> 1.0 (capitalized costs)' },
                          { code: 'SGI',  name: 'Sales Growth Index',        val: ex.beneish_ratios?.sgi,  flag: (ex.beneish_ratios?.sgi ?? 0) > 1.0,  hint: '> 1.0 (growth deceleration)' },
                          { code: 'DEPI', name: 'Depreciation Index',        val: ex.beneish_ratios?.depi, flag: (ex.beneish_ratios?.depi ?? 0) > 1.0, hint: '> 1.0 (slower depreciation)' },
                          { code: 'SGAI', name: 'SGA Expense Index',         val: ex.beneish_ratios?.sgai, flag: (ex.beneish_ratios?.sgai ?? 0) > 1.0, hint: '> 1.0 (admin cost inflation)' },
                          { code: 'LVGI', name: 'Leverage Index',            val: ex.beneish_ratios?.lvgi, flag: (ex.beneish_ratios?.lvgi ?? 0) > 1.0, hint: '> 1.0 (increasing debt)' },
                          { code: 'TATA', name: 'Total Accruals / Assets',   val: ex.beneish_ratios?.tata, flag: (ex.beneish_ratios?.tata ?? 0) > 0.0, hint: '> 0.0 (earnings > cash)' },
                        ].map(item => (
                          <Grid item xs={6} sm={3} key={item.code}>
                            <Box sx={{
                              p: 1, borderRadius: 1.5,
                              border: `1px solid ${item.flag ? '#fecaca' : '#e2e8f0'}`,
                              bgcolor: item.flag ? '#fff5f5' : '#f8fafc',
                              height: '100%',
                              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                            }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: item.flag ? '#b91c1c' : '#475569', fontSize: '0.68rem', display: 'block' }}>
                                {item.code}
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, color: item.flag ? '#dc2626' : '#1e293b', my: 0.25 }}>
                                {item.val != null ? Number(item.val).toFixed(3) : '—'}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.1 }}>
                                {item.hint}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Audit Explanation Reasons */}
                {ex.reasons?.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', mb: 0.75, fontSize: '0.72rem' }}>
                      Model Reason Codes & Diagnostic Logs
                    </Typography>
                    <Grid container spacing={1}>
                      {ex.reasons.map(rc => (
                        <Grid item key={rc.code} xs={12} sm={6} md={4}>
                          <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.25 }}>
                            <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 0.5, fontSize: '0.72rem', lineHeight: 1.3 }}>
                              {rc.label}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : '#f57c00' }}>
                                {(rc.weight ?? 0).toFixed(2)}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={(rc.weight ?? 0) * 100}
                                sx={{
                                  flexGrow: 1, height: 3, borderRadius: 2, bgcolor: '#f1f5f9',
                                  '& .MuiLinearProgress-bar': { bgcolor: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : '#f57c00' }
                                }}
                              />
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default function FinancialExceptions() {
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const initialThreshold = searchParams.get('threshold') ? parseFloat(searchParams.get('threshold')) : DEFAULTS.FS_DETECTION_THRESHOLD

  const [exceptions, setExceptions]                 = useState([])
  const [threshold,  setThreshold]                  = useState(initialThreshold)
  const [debouncedThreshold, setDebouncedThreshold] = useState(initialThreshold)
  const [loading,    setLoading]                    = useState(true)
  const [sortBy,     setSortBy]                     = useState('score_desc')
  const [statusFilter, setStatusFilter]             = useState(initialStatus ? [initialStatus] : [])
  const [search,     setSearch]                     = useState('')
  const [spotlightView, setSpotlightView]           = useState('quadrant') // 'quadrant' | 'risk_vs_m' | 'risk_vs_z'
  const [showBanner, setShowBanner]                 = useState(false)
  const [totalDbExceptions, setTotalDbExceptions]   = useState(null)
  const [page, setPage]                             = useState(1)
  const [pageSize, setPageSize]                     = useState(25)

  // Debounce slider threshold
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedThreshold(threshold)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [threshold])

  // Fetch corporate financial exceptions
  const reloadExceptions = () => {
    setLoading(true)
    Promise.all([
      getFsExceptions(0.0, 1000),
      getSummaryStats(),
    ]).then(([ex, stats]) => {
      setExceptions(ex || [])
      setTotalDbExceptions(stats?.fs_exceptions ?? ex?.length ?? 0)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      getFsExceptions(0.0, 1000),
      getSummaryStats(),
    ]).then(([ex, stats]) => {
      if (mounted) {
        setExceptions(ex || [])
        setTotalDbExceptions(stats?.fs_exceptions ?? ex?.length ?? 0)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  // Show banner with slide-in if empty
  useEffect(() => {
    if (!loading && exceptions.length === 0) {
      const timer = setTimeout(() => setShowBanner(true), 150)
      return () => clearTimeout(timer)
    } else {
      setShowBanner(false)
    }
  }, [loading, exceptions.length])

  // Filter and sort exceptions
  const filtered = useMemo(() => {
    let list = exceptions.filter(e => (e.ensemble_score ?? 0) >= debouncedThreshold)
    if (statusFilter.length) list = list.filter(e => statusFilter.includes(e.status))
    if (search.trim()) {
      const t = search.toLowerCase()
      list = list.filter(e => e.ticker?.toLowerCase().includes(t) || e.company?.toLowerCase().includes(t))
    }

    switch (sortBy) {
      case 'score_desc':
        list.sort((a, b) => (b.ensemble_score ?? 0) - (a.ensemble_score ?? 0))
        break
      case 'score_asc':
        list.sort((a, b) => (a.ensemble_score ?? 0) - (b.ensemble_score ?? 0))
        break
      case 'm_score_desc':
        list.sort((a, b) => (b.m_score ?? -99) - (a.m_score ?? -99))
        break
      case 'm_score_asc':
        list.sort((a, b) => (a.m_score ?? -99) - (b.m_score ?? -99))
        break
      case 'z_score_asc':
        list.sort((a, b) => (a.z_score ?? 99) - (b.z_score ?? 99))
        break
      case 'z_score_desc':
        list.sort((a, b) => (b.z_score ?? 99) - (a.z_score ?? 99))
        break
      case 'company_asc':
        list.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''))
        break
      case 'company_desc':
        list.sort((a, b) => (b.company ?? '').localeCompare(a.company ?? ''))
        break
      case 'ticker_asc':
        list.sort((a, b) => (a.ticker ?? '').localeCompare(b.ticker ?? ''))
        break
      case 'ticker_desc':
        list.sort((a, b) => (b.ticker ?? '').localeCompare(a.ticker ?? ''))
        break
      case 'fy_desc':
        list.sort((a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0))
        break
      case 'fy_asc':
        list.sort((a, b) => (a.fiscal_year ?? 0) - (b.fiscal_year ?? 0))
        break
      default:
        list.sort((a, b) => (b.ensemble_score ?? 0) - (a.ensemble_score ?? 0))
    }
    return list
  }, [exceptions, debouncedThreshold, statusFilter, search, sortBy])

  // Paginated slice
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const handleHeaderSort = (col) => {
    setPage(1)
    if (sortBy === `${col}_desc`) {
      setSortBy(`${col}_asc`)
    } else {
      setSortBy(`${col}_desc`)
    }
  }

  /* ── Chart 1: Altman Solvency Distribution Data ─────────────────── */
  const solvencyData = useMemo(() => {
    if (!exceptions.length) return []
    const total = exceptions.length
    const distress = exceptions.filter(e => e.z_score != null && e.z_score < THRESHOLDS.Z_SCORE_GREY).length
    const grey = exceptions.filter(e => e.z_score != null && e.z_score >= THRESHOLDS.Z_SCORE_GREY && e.z_score <= THRESHOLDS.Z_SCORE_SAFE).length
    const safe = exceptions.filter(e => e.z_score != null && e.z_score > THRESHOLDS.Z_SCORE_SAFE).length
    const manip = exceptions.filter(e => e.m_score != null && e.m_score > THRESHOLDS.M_SCORE_MANIPULATION).length

    return [
      { name: 'Distress (Z<1.81)', Benchmark: 5.0, Observed: +((distress / total) * 100).toFixed(1), count: distress },
      { name: 'Grey (1.81-2.99)', Benchmark: 15.0, Observed: +((grey / total) * 100).toFixed(1), count: grey },
      { name: 'Safe (Z>2.99)', Benchmark: 80.0, Observed: +((safe / total) * 100).toFixed(1), count: safe },
      { name: 'Manip (M>-2.22)', Benchmark: 3.0, Observed: +((manip / total) * 100).toFixed(1), count: manip },
    ]
  }, [exceptions])

  /* ── Chart 2: Decile Risk Score Distribution Data ───────────────── */
  const scoreDecileData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const min = i / 10, max = (i + 1) / 10
      return {
        range: `${(min * 100).toFixed(0)}–${(max * 100).toFixed(0)}%`,
        count: exceptions.filter(e => (e.ensemble_score ?? 0) >= min && (e.ensemble_score ?? 0) < max).length,
      }
    })
  }, [exceptions])

  /* ── Chart 3: Spotlight Scatter Matrix Data ──────────────────────── */
  const scatterData = useMemo(() => {
    return filtered.map(e => {
      let x = 0, y = 0
      if (spotlightView === 'quadrant') {
        x = typeof e.z_score === 'number' ? e.z_score : 2.5
        y = typeof e.m_score === 'number' ? e.m_score : -3.0
      } else if (spotlightView === 'risk_vs_m') {
        x = Number(e.ensemble_score) || 0
        y = typeof e.m_score === 'number' ? e.m_score : -3.0
      } else {
        x = Number(e.ensemble_score) || 0
        y = typeof e.z_score === 'number' ? e.z_score : 2.5
      }
      return {
        ...e,
        x,
        y,
        r: Math.max(5, Math.min(10, (e.ensemble_score ?? 0.5) * 9)),
      }
    })
  }, [filtered, spotlightView])

  // Metric counts
  const mFlags   = exceptions.filter(e => e.m_score != null && e.m_score > THRESHOLDS.M_SCORE_MANIPULATION).length
  const zFlags   = exceptions.filter(e => e.z_score != null && e.z_score < THRESHOLDS.Z_SCORE_GREY).length
  const critical = exceptions.filter(e => (e.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK).length

  // CSV Export
  const handleExport = () => {
    const esc = s => `"${String(s || '').replace(/"/g, '""')}"`
    const rows = filtered.map(e => [
      esc(e.ticker),
      esc(e.company),
      e.fiscal_year,
      e.m_score != null ? e.m_score.toFixed(3) : '',
      e.z_score != null ? e.z_score.toFixed(3) : '',
      e.ensemble_score != null ? (e.ensemble_score * 100).toFixed(1) + '%' : '',
      esc(e.altman_zone || ''),
      esc(e.status),
    ].join(','))
    const header = 'ticker,company,fiscal_year,m_score,z_score,ensemble_risk_pct,altman_zone,status'
    const csv  = `${header}\n${rows.join('\n')}`
    const a    = document.createElement('a')
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.href     = url
    a.download = 'financial_statement_exceptions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Empty State Banner — Slide Transition */}
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
                to="/upload?tab=statements"
                sx={{ textTransform: 'none', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600, mt: 0.5 }}
              >
                Go to Upload Data →
              </Button>
            }
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No Corporate Financial Statements Available</Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
              Upload a financial statements CSV in the Data Ingestion Portal to begin Altman Z-score solvency and Beneish M-score fraud analysis.
            </Typography>
          </Alert>
        </Slide>
      )}

      {/* Quick Filter Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          {
            title: 'M-Score Manipulation Flags',
            value: mFlags,
            desc: 'M > -2.22 (earnings inflation risk)',
            color: '#d32f2f',
            action: () => { setSortBy('m_score_desc'); setPage(1); }
          },
          {
            title: 'Z-Score Distress Flags',
            value: zFlags,
            desc: 'Z < 1.81 (insolvency / bankruptcy risk)',
            color: '#f57c00',
            action: () => { setSortBy('z_score_asc'); setPage(1); }
          },
          {
            title: 'Critical Risk (≥ 80%)',
            value: critical,
            desc: 'Extreme multi-model anomaly probability',
            color: '#9c27b0',
            action: () => { setThreshold(0.80); setPage(1); }
          },
          {
            title: 'Total Analyzed Records',
            value: exceptions.length,
            desc: `${filtered.length} currently visible at threshold ${threshold.toFixed(2)}`,
            color: '#0284c7',
            action: () => { setThreshold(0.0); setSearch(''); setStatusFilter([]); setPage(1); }
          },
        ].map(sc => (
          <Grid item xs={12} sm={6} md={3} key={sc.title}>
            <Card
              onClick={sc.action}
              sx={{
                borderRadius: '12px',
                boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 18px 0 rgba(0,0,0,.12)' },
                borderTop: `4px solid ${sc.color}`,
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: '#64748b', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  {sc.title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: sc.color, my: 0.5 }}>
                  {sc.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                  {sc.desc}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Top 2 Vibrant Gradient ChartCards (Matching Ledger) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Left Card: Altman Solvency Distribution (Expected vs Observed) */}
        <Grid item xs={12} md={5}>
          <ChartCard
            color="linear-gradient(195deg, #66BB6A, #388E3C)"
            shadow="0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(76,175,80,.4)"
            title="Altman Z-Score Solvency Distribution"
            subtitle={exceptions.length > 0 ? `Distress (<1.81): ${zFlags} · Safe (>2.99): ${exceptions.filter(e => (e.z_score ?? 0) > THRESHOLDS.Z_SCORE_SAFE).length} · Manipulators: ${mFlags}` : 'Awaiting data'}
            footer={zFlags > 0 ? `${zFlags} companies flag severe insolvency distress risk (Z < 1.81)` : 'All analyzed corporations within safe or grey solvency zones'}
            headerHeight={200}
          >
            {exceptions.length > 0 && solvencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={solvencyData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <Bar dataKey="Benchmark" fill="rgba(255,255,255,0.3)" radius={[2, 2, 0, 0]} name="Expected Benchmark %" />
                  <Bar dataKey="Observed" fill="rgba(255,255,255,0.9)" radius={[2, 2, 0, 0]} name="Observed %" />
                  <XAxis dataKey="name" tick={{ fill: '#fff', fontSize: 10 }} axisLine={false} tickLine={false} />
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

        {/* Right Card: Ensemble Risk Score Distribution Deciles */}
        <Grid item xs={12} md={7}>
          <ChartCard
            color="linear-gradient(195deg, #EF5350, #C62828)"
            shadow="0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(244,67,54,.4)"
            title="Score Distribution"
            subtitle={
              filtered.length > 0
                ? `${filtered.length} exceptions ${debouncedThreshold > 0 ? `above threshold ${debouncedThreshold.toFixed(2)}` : 'across all risk tiers'}${totalDbExceptions ? ` (${totalDbExceptions.toLocaleString()} total in database)` : ''}`
                : 'Awaiting data'
            }
            footer={
              debouncedThreshold > 0
                ? `Filtered at threshold: ${debouncedThreshold.toFixed(2)} · Showing ${filtered.length} of ${totalDbExceptions || exceptions.length}`
                : `Showing all ${totalDbExceptions || exceptions.length} corporate exceptions in database`
            }
            headerHeight={200}
          >
            {exceptions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDecileData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <Bar dataKey="count" fill="rgba(255,255,255,0.85)" radius={[2, 2, 0, 0]} name="Companies" />
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

      {/* Exceptions Spotlight Scatter Chart (WhiteChartCard) */}
      <Box sx={{ mb: 4 }}>
        <WhiteChartCard
          title="Exceptions Spotlight — Financial Statement Risk vs Solvency Matrix"
          subtitle="Interactive scatter matrix: High risk & distressed entries (top-left in Quadrant view) flag simultaneous earnings manipulation and high bankruptcy probability. Click any point to filter the table below."
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
                Tip: Click any point to filter the corporate forensic table below
              </Typography>
            </Box>
          }
          height={370}
        >
          {/* Header Controls for Spotlight Matrix */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
              Displaying <strong>{scatterData.length}</strong> corporate filings in spotlight
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>
                View Mode:
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={spotlightView}
                exclusive
                onChange={(e, val) => { if (val !== null) setSpotlightView(val) }}
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
                <ToggleButton value="quadrant">Z vs M Quadrant</ToggleButton>
                <ToggleButton value="risk_vs_m">Risk vs M-Score</ToggleButton>
                <ToggleButton value="risk_vs_z">Risk vs Z-Score</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>

          {exceptions.length > 0 ? (
            <ResponsiveContainer width="100%" height={290}>
              <ScatterChart margin={{ top: 25, right: 30, left: 25, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={spotlightView === 'quadrant' ? 'Altman Z-Score' : 'Risk Score'}
                  domain={spotlightView === 'quadrant' ? ['dataMin - 1', 'dataMax + 1'] : [0, 1]}
                  ticks={spotlightView === 'quadrant' ? undefined : [0, 0.25, 0.5, 0.75, 1.0]}
                  tickFormatter={v => spotlightView === 'quadrant' ? v.toFixed(1) : `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                >
                  <Label
                    value={spotlightView === 'quadrant' ? 'Altman Z-Score (Solvency: < 1.81 Distress) →' : 'Ensemble Risk Score (Probability) →'}
                    position="bottom"
                    offset={12}
                    style={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  name={spotlightView === 'risk_vs_z' ? 'Altman Z-Score' : 'Beneish M-Score'}
                  width={65}
                  tickFormatter={v => v.toFixed(1)}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#cbd5e1"
                >
                  <Label
                    value={spotlightView === 'risk_vs_z' ? 'Altman Z-Score' : 'Beneish M-Score (Manipulation: > -2.22)'}
                    angle={-90}
                    position="insideLeft"
                    offset={12}
                    style={{ textAnchor: 'middle', fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                </YAxis>

                {/* Reference lines according to view */}
                {spotlightView !== 'risk_vs_z' && (
                  <ReferenceLine
                    y={THRESHOLDS.M_SCORE_MANIPULATION}
                    stroke="#d32f2f"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `M = ${THRESHOLDS.M_SCORE_MANIPULATION} (Manipulation Risk)`, position: 'top', fill: '#d32f2f', fontSize: 10, fontWeight: 700 }}
                  />
                )}

                {spotlightView === 'quadrant' && (
                  <>
                    <ReferenceLine
                      x={THRESHOLDS.Z_SCORE_GREY}
                      stroke="#f57c00"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `Z = ${THRESHOLDS.Z_SCORE_GREY} (Distress)`, position: 'top', fill: '#f57c00', fontSize: 10, fontWeight: 700 }}
                    />
                    <ReferenceLine
                      x={THRESHOLDS.Z_SCORE_SAFE}
                      stroke="#388e3c"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `Z = ${THRESHOLDS.Z_SCORE_SAFE} (Safe)`, position: 'top', fill: '#388e3c', fontSize: 10, fontWeight: 700 }}
                    />
                  </>
                )}

                {spotlightView !== 'quadrant' && (
                  <>
                    <ReferenceLine
                      x={THRESHOLDS.CRITICAL_RISK}
                      stroke="#d32f2f"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `Critical (${THRESHOLDS.CRITICAL_RISK * 100}%)`, position: 'top', fill: '#d32f2f', fontSize: 10, fontWeight: 700 }}
                    />
                    <ReferenceLine
                      x={THRESHOLDS.MEDIUM_RISK}
                      stroke="#f57c00"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `High (${THRESHOLDS.MEDIUM_RISK * 100}%)`, position: 'top', fill: '#f57c00', fontSize: 10, fontWeight: 700 }}
                    />
                  </>
                )}

                <RTooltip content={<FinancialScatterTooltip />} />
                <Scatter
                  data={scatterData}
                  shape="circle"
                  cursor="pointer"
                  onClick={(entry) => {
                    if (entry?.ticker) setSearch(entry.ticker)
                  }}
                >
                  {scatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={(entry.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (entry.ensemble_score ?? 0) >= THRESHOLDS.MEDIUM_RISK ? '#f57c00' : '#1976d2'}
                      fillOpacity={0.78}
                      stroke="#ffffff"
                      strokeWidth={1}
                      r={entry.r}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 290, color: '#ccc' }}>
              <Assessment sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#999' }}>No exceptions to display</Typography>
              <Typography variant="caption" sx={{ color: '#bbb', fontSize: '0.75rem' }}>Upload corporate financial statement data in Data Ingestion Portal to view risk matrix</Typography>
            </Box>
          )}
        </WhiteChartCard>
      </Box>

      {/* Controls + Table Card (Matching Ledger) */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
        <CardContent>
          {/* Header Row with Title, Subtitle, and Export/Refresh */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                Corporate Financial Statement Exceptions
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                {filtered.length > 0 ? (
                  debouncedThreshold > 0 || statusFilter.length > 0 || search.trim() ? (
                    <>Showing <strong>{Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> filtered exceptions {totalDbExceptions ? <>(of <strong>{totalDbExceptions.toLocaleString()}</strong> total in database)</> : null} (Page {page} of {totalPages})</>
                  ) : (
                    <>Showing <strong>{Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> total corporate exceptions in database (Page {page} of {totalPages})</>
                  )
                ) : (
                  <>Showing 0 exceptions</>
                )} · Click table headers or use dropdown to sort
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Refresh fontSize="small" />}
                onClick={reloadExceptions}
                disabled={loading}
                sx={{ textTransform: 'none', fontSize: '0.8rem', borderColor: '#cbd5e1', color: '#475569' }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={handleExport}
                sx={{ textTransform: 'none', fontSize: '0.8rem', borderColor: '#cbd5e1', color: '#475569' }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>

          {/* Filter Row: 4 Column Grid (Matching Ledger) */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* 1. Risk Threshold Slider */}
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

            {/* 2. Search Box */}
            <Grid item xs={12} sm={3}>
              <TextField
                size="small"
                fullWidth
                label="Search company / ticker"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: '#bbb', mr: 0.5 }} /> }}
                sx={{ '& .MuiInputLabel-root': { fontSize: '0.82rem' } }}
              />
            </Grid>

            {/* 3. Status Filter Multi-Select */}
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

            {/* 4. Sort By Dropdown */}
            <Grid item xs={12} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Sort By</InputLabel>
                <Select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} label="Sort By" sx={{ fontSize: '0.82rem' }}>
                  <MenuItem value="score_desc"  sx={{ fontSize: '0.82rem' }}>Score ↓ (Highest First)</MenuItem>
                  <MenuItem value="score_asc"   sx={{ fontSize: '0.82rem' }}>Score ↑ (Lowest First)</MenuItem>
                  <MenuItem value="m_score_desc" sx={{ fontSize: '0.82rem' }}>M-Score ↓ (High Manipulation)</MenuItem>
                  <MenuItem value="m_score_asc"  sx={{ fontSize: '0.82rem' }}>M-Score ↑ (Clean First)</MenuItem>
                  <MenuItem value="z_score_asc"  sx={{ fontSize: '0.82rem' }}>Z-Score ↑ (Severe Distress)</MenuItem>
                  <MenuItem value="z_score_desc" sx={{ fontSize: '0.82rem' }}>Z-Score ↓ (Safest First)</MenuItem>
                  <MenuItem value="company_asc"  sx={{ fontSize: '0.82rem' }}>Company (A → Z)</MenuItem>
                  <MenuItem value="company_desc" sx={{ fontSize: '0.82rem' }}>Company (Z → A)</MenuItem>
                  <MenuItem value="ticker_asc"   sx={{ fontSize: '0.82rem' }}>Ticker (A → Z)</MenuItem>
                  <MenuItem value="ticker_desc"  sx={{ fontSize: '0.82rem' }}>Ticker (Z → A)</MenuItem>
                  <MenuItem value="fy_desc"      sx={{ fontSize: '0.82rem' }}>Fiscal Year ↓ (Newest First)</MenuItem>
                  <MenuItem value="fy_asc"       sx={{ fontSize: '0.82rem' }}>Fiscal Year ↑ (Oldest First)</MenuItem>
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
                      onClick={() => handleHeaderSort('ticker')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Ticker {sortBy === 'ticker_desc' ? '↓' : sortBy === 'ticker_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('company')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Company {sortBy === 'company_desc' ? '↓' : sortBy === 'company_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('fy')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Fiscal Year {sortBy === 'fy_desc' ? '↓' : sortBy === 'fy_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('m_score')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      M-Score {sortBy === 'm_score_desc' ? '↓' : sortBy === 'm_score_asc' ? '↑' : '↕'}
                    </TableCell>
                    <TableCell
                      onClick={() => handleHeaderSort('z_score')}
                      sx={{ cursor: 'pointer', '&:hover': { color: '#9c27b0' } }}
                    >
                      Z-Score {sortBy === 'z_score_desc' ? '↓' : sortBy === 'z_score_asc' ? '↑' : '↕'}
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
                  {paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: '#999' }}>
                        No corporate exceptions match the current filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map(ex => (
                      <FsRow
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

          {/* Pagination Controls (Matching Ledger) */}
          {filtered.length > 0 && (
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
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> · Showing <strong>{Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> filtered exceptions {totalDbExceptions ? `(${totalDbExceptions.toLocaleString()} total in database)` : ''}
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => {
                  setPage(newPage)
                  window.scrollTo({ top: 400, behavior: 'smooth' })
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

