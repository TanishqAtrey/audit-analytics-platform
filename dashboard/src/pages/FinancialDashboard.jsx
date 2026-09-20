import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Typography, Card, CardContent, Divider,
  CircularProgress, Alert, LinearProgress, Tooltip, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material'
import { AccountBalance, WarningAmber, CheckCircle, TrendingDown, Assessment, Security, ArrowForward } from '@mui/icons-material'
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ReferenceLine, Label
} from 'recharts'

import StatCard from '../components/StatCard'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { getFsExceptions, healthCheck } from '../api/client'
import { StatusChip, SeverityChip } from '../components/StatusChip'
import { THRESHOLDS, DEFAULTS } from '../config/constants'

const G = {
  purple: 'linear-gradient(195deg, #CE93D8, #AB47BC)',
  red:    'linear-gradient(195deg, #EF9A9A, #E53935)',
  orange: 'linear-gradient(195deg, #FFCC80, #FB8C00)',
  green:  'linear-gradient(195deg, #80CBC4, #00897B)',
  blue:   'linear-gradient(195deg, #90CAF9, #1976D2)',
}

const S = {
  purple: '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(156,39,176,.4)',
  red:    '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(244,67,54,.4)',
  orange: '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(255,152,0,.4)',
  green:  '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(76,175,80,.4)',
  blue:   '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(33,150,243,.4)',
}

function MatrixTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const m = typeof d.m_score === 'number' ? d.m_score : null
  const z = typeof d.z_score === 'number' ? d.z_score : null
  const ens = typeof d.ensemble_score === 'number' ? d.ensemble_score : 0
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5, boxShadow: 2, fontSize: '0.78rem' }}>
      <Typography variant="caption" fontWeight={700} display="block" color="#1e293b">{d.ticker} — {d.company}</Typography>
      <Typography variant="caption" display="block" color="text.secondary">Fiscal Year: {d.fiscal_year}</Typography>
      <Box sx={{ mt: 0.5 }}>
        <span style={{ color: '#d32f2f', fontWeight: 700 }}>M-Score: {m !== null ? m.toFixed(2) : 'N/A'}</span>
        {m !== null && m > THRESHOLDS.M_SCORE_MANIPULATION && <Chip label="Manipulator Risk" size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }} />}
      </Box>
      <Box>
        <span style={{ color: '#f57c00', fontWeight: 700 }}>Z-Score: {z !== null ? z.toFixed(2) : 'N/A'}</span>
        {z !== null && z < THRESHOLDS.Z_SCORE_GREY && <Chip label="Distress Zone" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }} />}
      </Box>
      <Box sx={{ mt: 0.25 }}>
        <span style={{ color: '#9c27b0', fontWeight: 700 }}>Ensemble Risk: {(ens * 100).toFixed(1)}%</span>
      </Box>
    </Box>
  )
}

export default function FinancialDashboard() {
  const [exceptions, setExceptions] = useState([])
  const [live, setLive]             = useState(false)
  const [loading, setLoading]       = useState(true)

  const mounted = React.useRef(true)

  const loadData = () => {
    Promise.all([
      healthCheck(),
      getFsExceptions(DEFAULTS.MIN_EXCEPTION_SCORE),
    ]).then(([ok, data]) => {
      if (mounted.current) {
        setLive(ok)
        setExceptions(data || [])
        setLoading(false)
      }
    }).catch(() => {
      if (mounted.current) {
        setExceptions([])
        setLoading(false)
      }
    })
  }

  useEffect(() => {
    mounted.current = true
    loadData()
    return () => { mounted.current = false }
  }, [])

  const stats = useMemo(() => {
    const total = exceptions.length
    const mFlags = exceptions.filter(e => typeof e.m_score === 'number' && e.m_score > THRESHOLDS.M_SCORE_MANIPULATION).length
    const zFlags = exceptions.filter(e => typeof e.z_score === 'number' && e.z_score < THRESHOLDS.Z_SCORE_GREY).length
    const highRisk = exceptions.filter(e => (e.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK).length
    return { total, mFlags, zFlags, highRisk }
  }, [exceptions])

  const scatterData = useMemo(() => {
    return exceptions.map(e => ({
      ...e,
      x: typeof e.z_score === 'number' ? e.z_score : 2.5,
      y: typeof e.m_score === 'number' ? e.m_score : -3.0,
      z: Math.max((e.ensemble_score ?? 0.5) * 14, 4),
    }))
  }, [exceptions])

  const zDistressData = useMemo(() => {
    const distress = exceptions.filter(e => typeof e.z_score === 'number' && e.z_score < THRESHOLDS.Z_SCORE_GREY).length
    const grey = exceptions.filter(e => typeof e.z_score === 'number' && e.z_score >= THRESHOLDS.Z_SCORE_GREY && e.z_score <= THRESHOLDS.Z_SCORE_SAFE).length
    const safe = exceptions.filter(e => typeof e.z_score === 'number' && e.z_score > THRESHOLDS.Z_SCORE_SAFE).length
    return [
      { name: 'Distress (< THRESHOLDS.Z_SCORE_GREY)', value: distress, fill: '#d32f2f' },
      { name: 'Grey Zone (THRESHOLDS.Z_SCORE_GREY–THRESHOLDS.Z_SCORE_SAFE)', value: grey, fill: '#f57c00' },
      { name: 'Safe Zone (> THRESHOLDS.Z_SCORE_SAFE)', value: safe, fill: '#388e3c' },
    ].filter(d => d.value > 0)
  }, [exceptions])

  const ratioDriversData = useMemo(() => {
    const counts = {
      'DSRI (Receivables)': 0,
      'GMI (Gross Margin)': 0,
      'AQI (Asset Quality)': 0,
      'SGI (Sales Growth)': 0,
      'DEPI (Depreciation)': 0,
      'SGAI (Admin Exp)': 0,
      'LVGI (Leverage)': 0,
      'TATA (Total Accruals)': 0,
    }
    exceptions.forEach(e => {
      (e.reasons || []).forEach(r => {
        const lbl = r.label || r.code || ''
        Object.keys(counts).forEach(k => {
          if (lbl.toLowerCase().includes(k.split(' ')[0].toLowerCase())) {
            counts[k] += 1
          }
        })
      })
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [exceptions])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Empty State Banner */}
      {exceptions.length === 0 && (
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
              href="/upload"
              sx={{ textTransform: 'none', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600, mt: 0.5 }}
            >
              Go to Upload Data →
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No Financial Statement Data Available</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
            Upload a financial statements CSV in the Data Ingestion Portal to run Beneish M-Score and Altman Z-Score analysis.
          </Typography>
        </Alert>
      )}

      {/* ── KPI Stat Cards ────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            icon: <AccountBalance />, iconColor: G.blue, iconShadow: S.blue,
            title: 'Statements Scanned',
            value: stats.total.toLocaleString(),
            footer: 'Across uploaded datasets',
          },
          {
            icon: <WarningAmber />, iconColor: G.red, iconShadow: S.red,
            title: 'Beneish M-Score Flags',
            value: stats.mFlags.toLocaleString(),
            footer: 'Score > −2.22 (Earnings manipulation)',
            trend: stats.mFlags > 0 ? { value: 'High Risk', up: false } : undefined,
          },
          {
            icon: <TrendingDown />, iconColor: G.orange, iconShadow: S.orange,
            title: 'Altman Z-Score Distress',
            value: stats.zFlags.toLocaleString(),
            footer: `Score < ${THRESHOLDS.Z_SCORE_GREY} (Insolvency risk)`,
          },
          {
            icon: <Security />, iconColor: G.purple, iconShadow: S.purple,
            title: 'Critical Risk Entities',
            value: stats.highRisk.toLocaleString(),
            footer: 'Ensemble score ≥ 80%',
          },
        ].map((card, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <StatCard {...card} />
          </Grid>
        ))}
      </Grid>

      {/* ── Visualizations Row 1: M-Score vs Z-Score Matrix & Distress Donut ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <WhiteChartCard
            title="Forensic Risk Matrix — Beneish M-Score vs Altman Z-Score"
            subtitle="Quadrant analysis: Top-Left represents maximum risk (manipulating earnings while entering bankruptcy distress)."
            footer={`M-Score > −2.22 indicates Earnings Manipulation · Z-Score < ${THRESHOLDS.Z_SCORE_GREY} indicates Financial Distress`}
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Altman Z-Score" domain={[0, 6]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1">
                  <Label value="Altman Z-Score (Solvency Strength) →" position="bottom" offset={5} style={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} />
                </XAxis>
                <YAxis type="number" dataKey="y" name="Beneish M-Score" domain={[-5, 2]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1">
                  <Label value="Beneish M-Score (Manipulation)" angle={-90} position="insideLeft" offset={-5} style={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} />
                </YAxis>
                <ReferenceLine y={THRESHOLDS.M_SCORE_MANIPULATION} stroke="#d32f2f" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "M = −2.22 (Manipulator Line)", position: "right", fill: "#d32f2f", fontSize: 9, fontWeight: 600 }} />
                <ReferenceLine x={THRESHOLDS.Z_SCORE_GREY} stroke="#f57c00" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Z = ${THRESHOLDS.Z_SCORE_GREY} (Distress Line)`, position: "top", fill: "#f57c00", fontSize: 9, fontWeight: 600 }} />
                <RTooltip content={<MatrixTooltip />} />
                <Scatter data={scatterData} shape="circle">
                  {scatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.m_score > THRESHOLDS.M_SCORE_MANIPULATION && entry.z_score < THRESHOLDS.Z_SCORE_GREY ? '#d32f2f' : entry.m_score > THRESHOLDS.M_SCORE_MANIPULATION ? '#f44336' : entry.z_score < THRESHOLDS.Z_SCORE_GREY ? '#ff9800' : '#388e3c'}
                      fillOpacity={0.85}
                      r={entry.z}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </WhiteChartCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <WhiteChartCard
            title="Solvency Health Breakdown"
            subtitle="Corporate bankruptcy distress zone classification."
            footer={`${exceptions.length} financial statement filings analyzed`}
            height={320}
          >
            {zDistressData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={zDistressData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {zDistressData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                <Typography variant="caption">Awaiting SEC statement ingestion...</Typography>
              </Box>
            )}
          </WhiteChartCard>
        </Grid>
      </Grid>

      {/* ── Bottom Section: Top Flagged Entities Watchlist ── */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  High-Risk Financial Entities
                </Typography>
                <Button
                  size="small"
                  href="/financial"
                  endIcon={<ArrowForward fontSize="small" />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Full Exception Matrix
                </Button>
              </Box>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #f0f0f0' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafafa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>TICKER / COMPANY</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>YEAR</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>M-SCORE</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Z-SCORE</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>RISK SCORE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {exceptions.slice(0, 6).map((ex) => (
                      <TableRow key={ex.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="#9c27b0" fontSize="0.82rem">
                            {ex.ticker}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ex.company}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>FY {ex.fiscal_year ?? 2023}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700, color: (typeof ex.m_score === 'number' && ex.m_score > THRESHOLDS.M_SCORE_MANIPULATION) ? '#d32f2f' : '#388e3c' }}>
                          {typeof ex.m_score === 'number' ? ex.m_score.toFixed(2) : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700, color: (typeof ex.z_score === 'number' && ex.z_score < THRESHOLDS.Z_SCORE_GREY) ? '#d32f2f' : (typeof ex.z_score === 'number' && ex.z_score < THRESHOLDS.Z_SCORE_SAFE) ? '#f57c00' : '#388e3c' }}>
                          {typeof ex.z_score === 'number' ? ex.z_score.toFixed(2) : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" fontWeight={700} color={(ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00'}>
                              {((ex.ensemble_score ?? 0) * 100).toFixed(1)}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(ex.ensemble_score ?? 0) * 100}
                              sx={{
                                width: 45, height: 4, borderRadius: 2,
                                bgcolor: '#f1f5f9',
                                '& .MuiLinearProgress-bar': { bgcolor: (ex.ensemble_score ?? 0) >= THRESHOLDS.CRITICAL_RISK ? '#d32f2f' : '#f57c00' }
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {exceptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                          No statements analyzed yet. Ingest statements in Data Ingestion Portal.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                Forensic Detection Thresholds
              </Typography>
              
              <Box sx={{ mb: 2, p: 2, bgcolor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#991b1b', mb: 0.5 }}>
                  Beneish M-Score Formula (Threshold: −2.22)
                </Typography>
                <Typography variant="caption" sx={{ color: '#7f1d1d', display: 'block', lineHeight: 1.5 }}>
                  Calculates probability of earnings manipulation. Models 8 indices: Days Sales in Receivables (DSRI), Gross Margin (GMI), Asset Quality (AQI), Sales Growth (SGI), Depreciation (DEPI), SGA Expenses (SGAI), Leverage (LVGI), and Total Accruals (TATA).
                </Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e', mb: 0.5 }}>
                  Altman Z-Score Formula (Threshold: {THRESHOLDS.Z_SCORE_GREY})
                </Typography>
                <Typography variant="caption" sx={{ color: '#78350f', display: 'block', lineHeight: 1.5 }}>
                  Predicts bankruptcy risk using 5 weighted metrics: Working Capital, Retained Earnings, EBIT, Market Cap / Debt, and Asset Turnover. Values &lt; {THRESHOLDS.Z_SCORE_GREY} indicate immediate distress.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
