import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Slider, FormControl,
  Select, MenuItem, OutlinedInput, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, CircularProgress,
  LinearProgress, Collapse, IconButton, TextField, Alert,
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp, Download } from '@mui/icons-material'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, ReferenceLine, Label, Cell,
} from 'recharts'

import { getFsExceptions, updateExceptionStatus } from '../api/client'
import { StatusChip, SeverityChip } from '../components/StatusChip'
import { THRESHOLDS, DEFAULTS } from '../config/constants'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2, fontSize: '0.78rem' }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.ticker} — {d.company}</Typography>
      <Typography variant="caption" display="block" color="text.secondary">FY {d.fiscal_year}</Typography>
      <Box sx={{ mt: 0.5 }}>
        <span style={{ color: '#f44336', fontWeight: 700 }}>M-Score: {d.m_score?.toFixed(2)}</span>
        {d.m_score > THRESHOLDS.M_SCORE_MANIPULATION && <Chip label="Manipulator risk" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }} />}
      </Box>
      <Box>
        <span style={{ color: '#ff9800', fontWeight: 700 }}>Z-Score: {d.z_score?.toFixed(2)}</span>
        {d.z_score < THRESHOLDS.Z_SCORE_GREY && <Chip label="Distress" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }} />}
      </Box>
      <Box><span style={{ color: '#9c27b0', fontWeight: 700 }}>Score: {((d.ensemble_score ?? 0) * 100).toFixed(1)}%</span></Box>
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

  const mColor = ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? '#d32f2f' : '#388e3c'
  const zColor = ex.z_score < THRESHOLDS.Z_SCORE_GREY ? '#d32f2f' : ex.z_score < THRESHOLDS.Z_SCORE_SAFE ? '#f57c00' : '#388e3c'

  return (
    <>
      <TableRow
        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' }, borderLeft: `4px solid ${(ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00'}` }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell sx={{ py: 1 }}>
          <IconButton size="small" aria-label={open ? "Collapse row" : "Expand row"}>{open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}</IconButton>
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, fontSize: '0.85rem', color: '#9c27b0' }}>{ex.ticker}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.8rem', color: '#3c4858', fontWeight: 500 }}>{ex.company}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.8rem', color: '#666' }}>FY {ex.fiscal_year}</TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, color: mColor, fontSize: '0.85rem' }}>
          {ex.m_score?.toFixed(2)}
          {ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION && <Chip label="Risk" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 700 }} />}
        </TableCell>
        <TableCell sx={{ py: 1, fontWeight: 700, color: zColor, fontSize: '0.85rem' }}>
          {ex.z_score?.toFixed(2)}
          {ex.z_score < THRESHOLDS.Z_SCORE_GREY && <Chip label="Distress" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 700 }} />}
        </TableCell>
        <TableCell sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00' }}>
              {((ex.ensemble_score ?? 0) * 100).toFixed(1)}%
            </Typography>
            <LinearProgress variant="determinate" value={(ex.ensemble_score ?? 0) * 100}
              sx={{ width: 50, height: 4, borderRadius: 2, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00' } }} />
          </Box>
        </TableCell>
        <TableCell sx={{ py: 1 }}><SeverityChip score={ex.ensemble_score} /></TableCell>
        <TableCell sx={{ py: 1 }}><StatusChip status={ex.status} /></TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: '#fafafa', p: 2, borderBottom: '1px solid #f0f0f0' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={7}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: '#999', display: 'block', mb: 1 }}>Why Flagged</Typography>
                  <Grid container spacing={1}>
                    {ex.reasons.map(rc => (
                      <Grid item key={rc.code} xs={6} sm={4}>
                        <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1 }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.7rem' }}>{rc.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : '#f57c00', fontSize: '0.9rem' }}>{(rc.weight ?? 0).toFixed(2)}</Typography>
                          <LinearProgress variant="determinate" value={(rc.weight ?? 0) * 100}
                            sx={{ height: 3, borderRadius: 2, mt: 0.3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: (rc.weight ?? 0) > 0.7 ? '#d32f2f' : '#f57c00' } }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <Select value={status} onChange={e => setStatus(e.target.value)} sx={{ fontSize: '0.82rem' }}>
                        {['unreviewed', 'confirmed', 'false_positive', 'needs_review'].map(s => (
                          <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                            {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button variant="contained" size="small" onClick={handleSave} disabled={saving}
                      sx={{ bgcolor: saved ? '#4caf50' : undefined, textTransform: 'none', fontSize: '0.8rem' }}>
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

export default function FinancialExceptions() {
  const [exceptions, setExceptions]     = useState([])
  const [threshold,  setThreshold]      = useState(DEFAULTS.DETECTION_THRESHOLD)
  const [statusFilter, setStatusFilter] = useState([])
  const [fyFilter,   setFyFilter]       = useState([])
  const [search,     setSearch]         = useState('')
  const [sortBy,     setSortBy]         = useState('score_desc')
  const [loading,    setLoading]        = useState(true)

  const [debouncedThreshold, setDebouncedThreshold] = useState(DEFAULTS.DETECTION_THRESHOLD)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedThreshold(threshold), 400)
    return () => clearTimeout(timer)
  }, [threshold])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getFsExceptions(debouncedThreshold).then(ex => {
      if (mounted) {
        setExceptions(ex || [])
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [debouncedThreshold])

  const filtered = useMemo(() => {
    let list = [...exceptions]
    if (statusFilter.length) list = list.filter(e => statusFilter.includes(e.status))
    if (fyFilter.length)     list = list.filter(e => fyFilter.includes(e.fiscal_year))
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
      case 'ticker_asc':
        list.sort((a, b) => (a.ticker ?? '').localeCompare(b.ticker ?? ''))
        break
      case 'ticker_desc':
        list.sort((a, b) => (b.ticker ?? '').localeCompare(a.ticker ?? ''))
        break
      default:
        list.sort((a, b) => (b.ensemble_score ?? 0) - (a.ensemble_score ?? 0))
    }
    return list
  }, [exceptions, statusFilter, fyFilter, search, sortBy])

  const handleHeaderSort = (col) => {
    if (sortBy === `${col}_desc`) {
      setSortBy(`${col}_asc`)
    } else {
      setSortBy(`${col}_desc`)
    }
  }

  const scatterData = filtered.map(e => ({
    ...e,
    x: e.z_score,
    y: e.m_score,
    z: (e.ensemble_score ?? 0) * 30 + 5,
  }))

  const mFlags   = filtered.filter(e => e.m_score > THRESHOLDS.M_SCORE_MANIPULATION).length
  const zFlags   = filtered.filter(e => e.z_score < THRESHOLDS.Z_SCORE_GREY).length
  const critical = filtered.filter(e => e.ensemble_score >= THRESHOLDS.CRITICAL_RISK).length

  const handleExport = () => {
    const esc = s => `"${String(s || '').replace(/"/g, '""')}"`
    const rows = filtered.map(e => `${esc(e.ticker)},${esc(e.company)},${e.fiscal_year},${e.m_score},${e.z_score},${e.ensemble_score},${e.status}`)
    const csv  = `ticker,company,fiscal_year,m_score,z_score,ensemble_score,status\n${rows.join('\n')}`
    const a    = document.createElement('a'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.href = url; a.download = 'fs_exceptions.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Empty State Prompt */}
      {exceptions.length === 0 && !loading && (
        <Alert
          severity="info"
          variant="filled"
          sx={{
            mb: 3,
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
              href="/upload"
              sx={{ textTransform: 'none', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600, mt: 0.5 }}
            >
              Go to Upload Data →
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No Financial Statement Exceptions Found</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
            No corporate statements have been loaded or flagged above threshold {threshold.toFixed(2)}. Upload a financial statements CSV to begin analysis.
          </Typography>
        </Alert>
      )}

      {/* Stat row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'M-Score Flags',   value: mFlags,          color: '#d32f2f', desc: 'M > −2.22 (manipulation risk)' },
          { label: 'Z-Score Distress',value: zFlags,          color: '#f57c00', desc: `Z < ${THRESHOLDS.Z_SCORE_GREY} (distress zone)` },
          { label: 'Critical (≥80%)', value: critical,        color: '#9c27b0', desc: 'High ensemble score' },
          { label: 'Total Flagged',   value: filtered.length, color: '#1976d2', desc: `Above threshold ${threshold.toFixed(2)}` },
        ].map(({ label, value, color, desc }) => (
          <Grid item xs={6} md={3} key={label}>
            <Card sx={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>{label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color, mt: 0.3 }}>{value}</Typography>
                <Typography variant="caption" sx={{ color: '#bbb', fontSize: '0.7rem' }}>{desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Scatter chart */}
      <WhiteChartCard
        title="Financial Risk Map — Beneish M-Score vs Altman Z-Score"
        subtitle="Bubble size = ensemble score. Top-left quadrant = high earnings manipulation and high bankruptcy risk."
        footer={`M > −2.22 = manipulation risk · Z < ${THRESHOLDS.Z_SCORE_GREY} = distress · Z ${THRESHOLDS.Z_SCORE_GREY}–${THRESHOLDS.Z_SCORE_SAFE} = grey zone`}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name="Z-Score" tick={{ fill: '#475569', fontSize: 11 }} stroke="#cbd5e1">
              <Label value="Altman Z-Score → (lower is distressed)" position="bottom" offset={0} style={{ fill: '#334155', fontSize: 12, fontWeight: 500 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" name="M-Score" tick={{ fill: '#475569', fontSize: 11 }} stroke="#cbd5e1">
              <Label value="Beneish M-Score (higher is riskier)" angle={-90} position="insideLeft" offset={0} style={{ fill: '#334155', fontSize: 12, fontWeight: 500 }} />
            </YAxis>
            <ReferenceLine x={THRESHOLDS.Z_SCORE_GREY}  stroke="#f57c00" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Distress Zone (${THRESHOLDS.Z_SCORE_GREY})`, position: "top", fill: "#f57c00", fontSize: 10, fontWeight: 600 }} />
            <ReferenceLine y={THRESHOLDS.M_SCORE_MANIPULATION} stroke="#d32f2f" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Manipulator Risk (${THRESHOLDS.M_SCORE_MANIPULATION})`, position: "right", fill: "#d32f2f", fontSize: 10, fontWeight: 600 }} />
            <RTooltip content={<ScatterTooltip />} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={(entry.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : (entry.ensemble_score ?? 0) >= THRESHOLDS.HIGH_RISK ? '#f57c00' : '#1976d2'}
                  fillOpacity={0.8}
                  r={entry.z}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </WhiteChartCard>

      {/* Threshold explainers */}
      <Grid container spacing={2} sx={{ my: 2 }}>
        {[
          { title: 'Beneish M-Score', threshold: '−2.22', color: '#d32f2f', desc: 'M > −2.22 indicates earnings manipulation risk. 8-variable model (Beneish 1999). Validated on Enron, WorldCom.', safe: 'M < −2.22 → Non-manipulator', risk: 'M > −2.22 → Manipulator risk' },
          { title: 'Altman Z-Score',  threshold: `${THRESHOLDS.Z_SCORE_GREY}`,  color: '#f57c00', desc: `Z < ${THRESHOLDS.Z_SCORE_GREY} = bankruptcy distress zone. 5-variable linear discriminant (Altman 1968). Uses working capital, EBIT, market cap, retained earnings.`, safe: `Z > ${THRESHOLDS.Z_SCORE_SAFE} → Safe`, risk: `Z < ${THRESHOLDS.Z_SCORE_GREY} → Distress zone`, mid: `${THRESHOLDS.Z_SCORE_GREY}–${THRESHOLDS.Z_SCORE_SAFE} → Grey zone` },
        ].map(({ title, threshold: thr, color, desc, safe, risk, mid }) => (
          <Grid item xs={12} md={6} key={title}>
            <Card sx={{ borderRadius: '10px', borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 0.5 }}>
                  {title} · Threshold: {thr}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666', fontSize: '0.82rem', lineHeight: 1.6, mb: 1 }}>{desc}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={risk}  size="small" color="error"   variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  {mid && <Chip label={mid}  size="small" color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                  <Chip label={safe} size="small" color="success"  variant="outlined" sx={{ fontSize: '0.7rem' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Financial Statement Exceptions</Typography>
              <Typography variant="body2" sx={{ color: '#999', fontSize: '0.8rem' }}>{filtered.length} companies flagged</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search Ticker / Company"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ width: 180, '& input': { fontSize: '0.8rem', py: 0.75 } }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>Threshold:</Typography>
                <Slider value={threshold} onChange={(_, v) => setThreshold(v)} min={0} max={1} step={0.05} color="warning" sx={{ width: 80 }} />
              </Box>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <Select multiple value={fyFilter} onChange={e => setFyFilter(e.target.value)} displayEmpty renderValue={sel => sel.length ? sel.join(', ') : 'All Years'} sx={{ fontSize: '0.8rem' }}>
                  {[2021, 2022, 2023].map(y => <MenuItem key={y} value={y} sx={{ fontSize: '0.82rem' }}>FY {y}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleExport} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>Export</Button>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress color="warning" /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: '#999', py: 1.5, cursor: 'pointer', userSelect: 'none' } }}>
                    <TableCell width={40} />
                    <TableCell onClick={() => handleHeaderSort('ticker')}>Ticker {sortBy === 'ticker_desc' ? '↓' : sortBy === 'ticker_asc' ? '↑' : '↕'}</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>FY</TableCell>
                    <TableCell onClick={() => handleHeaderSort('m_score')}>M-Score {sortBy === 'm_score_desc' ? '↓' : sortBy === 'm_score_asc' ? '↑' : '↕'}</TableCell>
                    <TableCell onClick={() => handleHeaderSort('z_score')}>Z-Score {sortBy === 'z_score_asc' ? '↑' : sortBy === 'z_score_desc' ? '↓' : '↕'}</TableCell>
                    <TableCell onClick={() => handleHeaderSort('score')}>Ensemble {sortBy === 'score_desc' ? '↓' : sortBy === 'score_asc' ? '↑' : '↕'}</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: '#999' }}>No exceptions at this threshold</TableCell></TableRow>
                  ) : (
                    filtered.map(ex => (
                      <FsRow key={ex.id} ex={ex} onStatusSave={(id, s) => setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: s } : e))} />
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

