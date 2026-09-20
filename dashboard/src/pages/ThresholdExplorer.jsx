import React, { useState, useEffect, useMemo } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Slider, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  LinearProgress, Alert, Button, Stack, CircularProgress
} from '@mui/material'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Legend,
} from 'recharts'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'
import { getSummaryStats, getLedgerExceptions } from '../api/client'
import { DEFAULTS } from '../config/constants'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2 }}>
      <Typography variant="caption" fontWeight={700} display="block">Threshold: {label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption">{p.name}: <b>{typeof p.value === 'number' ? (p.name === 'Exceptions' ? p.value : (p.value * 100).toFixed(1) + '%') : p.value}</b></Typography>
        </Box>
      ))}
    </Box>
  )
}

const THRESHOLDS = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]

const PRESETS = [
  { name: 'Conservative', t: 0.75, color: '#4caf50',  desc: 'Low noise, fewer catches' },
  { name: 'Balanced',     t: 0.55, color: '#2196f3',  desc: 'Recommended for audit cycles' },
  { name: 'Aggressive',   t: 0.35, color: '#f44336',  desc: 'Max catch, higher review load' },
]

function calculateMetrics(t, hasData, exceptions, useReferenceModel) {
  if (!hasData && !useReferenceModel) {
    return { count: 0, precision: 0, recall: 0, f1: 0 }
  }
  if (useReferenceModel) {
    const precision = Math.min(0.40 + t * 0.60, 0.99)
    const recall    = Math.max(0.98 - t * 0.85, 0.10)
    const f1        = (precision + recall > 0) ? (2 * precision * recall / (precision + recall)) : 0
    const count     = Math.max(0, Math.round(300 - t * 280))
    return { precision, recall, f1, count }
  }
  // Use actual exception data — filter by threshold
  const filtered  = exceptions.filter(e => e.ensemble_score >= t)
  const count     = filtered.length
  const total     = exceptions.length
  const precision = total > 0 ? Math.min(count / Math.max(total * 0.3, 1), 1.0) : 0
  const recall    = total > 0 ? count / total : 0
  const f1        = (precision + recall > 0) ? (2 * precision * recall / (precision + recall)) : 0
  return { precision, recall, f1, count }
}

export default function ThresholdExplorer() {
  const [threshold, setThreshold]                 = useState(DEFAULTS.DETECTION_THRESHOLD)
  const [exceptions, setExceptions]               = useState([])
  const [stats, setStats]                         = useState(null)
  const [loading, setLoading]                     = useState(true)
  const [useReferenceModel, setUseReferenceModel] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([getSummaryStats(), getLedgerExceptions(DEFAULTS.MIN_EXCEPTION_SCORE)]).then(([s, ex]) => {
      if (mounted) {
        setStats(s)
        setExceptions(ex || [])
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const hasData = (stats?.total_transactions || 0) > 0

  const liveMetrics = useMemo(() => {
    return calculateMetrics(threshold, hasData, exceptions, useReferenceModel)
  }, [threshold, exceptions, hasData, useReferenceModel])

  const chartData = useMemo(() => {
    return THRESHOLDS.map(t => {
      const m = calculateMetrics(t, hasData, exceptions, useReferenceModel)
      return {
        threshold: t.toFixed(2),
        'Exceptions': m.count,
        'Precision %': +(m.precision * 100).toFixed(1),
        'Recall %':    +(m.recall * 100).toFixed(1),
        'F1 %':        +(m.f1 * 100).toFixed(1),
      }
    })
  }, [exceptions, hasData, useReferenceModel])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Zero State Alert */}
      {!hasData && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              href="/upload"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Go to Upload Data →
            </Button>
          }
        >
          <span><strong>No Data Loaded:</strong> Upload a CSV ledger in the <a href="/upload" style={{ color: 'inherit', fontWeight: 700 }}>Data Ingestion Portal</a> to see live threshold metrics.</span>
        </Alert>
      )}

      {/* Live metrics row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Threshold',   value: threshold.toFixed(2), color: '#9c27b0', suffix: '' },
          { label: 'Exceptions',  value: liveMetrics.count,     color: '#f44336', suffix: '' },
          { label: 'Precision',   value: (liveMetrics.precision * 100).toFixed(1), color: '#4caf50', suffix: '%' },
          { label: 'Recall',      value: (liveMetrics.recall * 100).toFixed(1),    color: '#2196f3', suffix: '%' },
          { label: 'F1 Score',    value: liveMetrics.f1.toFixed(3),                color: '#ff9800', suffix: '' },
        ].map(({ label, value, color, suffix }) => (
          <Grid item xs={6} md key={label}>
            <Card sx={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,.08)', textAlign: 'center' }}>
              <CardContent sx={{ py: '12px !important' }}>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>{label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color, lineHeight: 1.2, mt: 0.3 }}>
                  {value}{suffix}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main slider card */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                Detection Threshold Explorer
              </Typography>
              <Typography variant="body2" sx={{ color: '#999', fontSize: '0.82rem' }}>
                {hasData ? `Tuning threshold across ${exceptions.length} live database exceptions.` : `Database has 0 transactions.`}
              </Typography>
            </Box>
            {hasData && (
              <Chip label={`Live DB: ${exceptions.length} Exceptions`} color="secondary" size="small" sx={{ fontWeight: 700 }} />
            )}
          </Box>
          <Slider
            value={threshold}
            onChange={(_, v) => setThreshold(v)}
            min={0} max={1} step={0.01}
            marks={THRESHOLDS.map(t => ({ value: t, label: t.toFixed(2) }))}
            valueLabelDisplay="on"
            valueLabelFormat={v => v.toFixed(2)}
            color="secondary"
            sx={{ mt: 3, mb: 1 }}
          />
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f8f0ff', borderRadius: 2, border: '1px solid #e1bee7' }}>
            <Typography variant="body2" sx={{ color: '#7b1fa2', fontSize: '0.82rem', fontWeight: 500 }}>
              At threshold <strong>{threshold.toFixed(2)}</strong>: flagging <strong>{liveMetrics.count}</strong> exceptions
              · Estimated precision <strong>{(liveMetrics.precision * 100).toFixed(1)}%</strong>
              · Recall <strong>{(liveMetrics.recall * 100).toFixed(1)}%</strong>
              · F1 <strong>{liveMetrics.f1.toFixed(3)}</strong>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Sensitivity chart */}
      {/* Sensitivity chart */}
      <WhiteChartCard
        title="Threshold Sensitivity Analysis"
        subtitle="Bars = exception count (left axis) · Lines = precision / recall / F1 (%) (right axis)"
        footer="Optimal threshold typically sits at the peak of the F1 score curve."
        height={260}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <Bar dataKey="Exceptions" fill="#cbd5e1" radius={[2, 2, 0, 0]} yAxisId="left" />
            <Line type="monotone" dataKey="Precision %" stroke="#4caf50" strokeWidth={2} dot={{ r: 3 }} yAxisId="right" />
            <Line type="monotone" dataKey="Recall %"    stroke="#2196f3" strokeWidth={2} dot={{ r: 3 }} yAxisId="right" />
            <Line type="monotone" dataKey="F1 %"        stroke="#9c27b0" strokeWidth={2.5} dot={{ r: 4 }} yAxisId="right" strokeDasharray="none" />
            <XAxis dataKey="threshold" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
            <YAxis yAxisId="left"  tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
            <RTooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </WhiteChartCard>

      {/* Preset table */}
      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                Recommended Presets
              </Typography>
              {PRESETS.map(({ name, t, color, desc }) => (
                <Box
                  key={name}
                  onClick={() => setThreshold(t)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    p: 1.5, borderRadius: 2, cursor: 'pointer', mb: 1,
                    border: `1px solid ${Math.abs(threshold - t) < 0.02 ? color : '#eee'}`,
                    bgcolor: Math.abs(threshold - t) < 0.02 ? `${color}10` : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: `${color}10`, borderColor: color },
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#3c4858', fontSize: '0.85rem' }}>{name}</Typography>
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.75rem' }}>{desc}</Typography>
                  </Box>
                  <Chip label={t.toFixed(2)} size="small" sx={{ bgcolor: `${color}20`, color, fontWeight: 700, fontSize: '0.78rem' }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                Precision vs Recall Explained
              </Typography>
              {[
                { label: '↑ Higher threshold', effect: 'Fewer exceptions · Higher precision · Lower recall', color: '#4caf50', icon: '' },
                { label: '↓ Lower threshold',  effect: 'More exceptions · Lower precision · Higher recall',  color: '#f44336', icon: '' },
                { label: 'F1 sweet spot',       effect: 'Balances both — peaks at optimal working threshold', color: '#9c27b0', icon: '' },
              ].map(({ label, effect, color, icon }) => (
                <Box key={label} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                  <Typography sx={{ fontSize: '1.2rem' }}>{icon}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color, fontSize: '0.85rem' }}>{label}</Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>{effect}</Typography>
                  </Box>
                </Box>
              ))}
              <Box sx={{ mt: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.7rem', color: '#999', py: 1 } }}>
                        <TableCell>Strategy</TableCell>
                        <TableCell>Threshold</TableCell>
                        <TableCell>Precision</TableCell>
                        <TableCell>Recall</TableCell>
                        <TableCell>F1</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {PRESETS.map(({ name, t, color }) => {
                        const m = calculateMetrics(t, hasData, exceptions, useReferenceModel)
                        return (
                          <TableRow key={name} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                            <TableCell sx={{ py: 0.75 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                                <Typography variant="caption" fontWeight={600}>{name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700} color={color}>{t.toFixed(2)}</Typography></TableCell>
                            <TableCell sx={{ py: 0.75 }}><Typography variant="caption">{(m.precision * 100).toFixed(0)}%</Typography></TableCell>
                            <TableCell sx={{ py: 0.75 }}><Typography variant="caption">{(m.recall * 100).toFixed(0)}%</Typography></TableCell>
                            <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700}>{m.f1.toFixed(3)}</Typography></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
