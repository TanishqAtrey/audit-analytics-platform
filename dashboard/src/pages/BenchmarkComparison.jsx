import React, { useEffect, useState } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, CircularProgress, Alert
} from '@mui/material'
import { Download, ShowChart } from '@mui/icons-material'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend
} from 'recharts'

import { getBenchmarkResults } from '../api/client'
import ChartCard, { WhiteChartCard } from '../components/ChartCard'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2 }}>
      <Typography variant="caption" fontWeight={700} display="block">Threshold: {label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption">{p.name}: <b>{p.value.toFixed(1)}%</b></Typography>
        </Box>
      ))}
    </Box>
  )
}

export default function BenchmarkComparison() {
  const [benchmark, setBenchmark] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBenchmarkResults().then(data => {
      setBenchmark(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress color="info" />
      </Box>
    )
  }

  if (!benchmark) {
    return (
      <Box sx={{ mt: 4 }}>
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
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No Benchmark Data Available</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
            Benchmark comparisons will appear after you upload data and run the detection pipeline. Upload a CSV ledger to get started.
          </Typography>
        </Alert>
        <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ShowChart sx={{ fontSize: 64, color: '#e0e0e0', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#999', mb: 1 }}>Precision, Recall & F1 Charts</Typography>
            <Typography variant="body2" sx={{ color: '#bbb', maxWidth: 420, mx: 'auto' }}>
              Once data is processed, this page will show baseline vs ensemble performance curves, F1 score lifts, and detailed comparison tables.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    )
  }

  const prChartData = benchmark.thresholds.map((t, idx) => ({
    threshold: t.toFixed(2),
    'Baseline Precision': benchmark.baseline_precision[idx] * 100,
    'Baseline Recall': benchmark.baseline_recall[idx] * 100,
    'Ensemble Precision': benchmark.ensemble_precision[idx] * 100,
    'Ensemble Recall': benchmark.ensemble_recall[idx] * 100,
  }))

  const f1ChartData = benchmark.thresholds.map((t, idx) => ({
    threshold: t.toFixed(2),
    'Baseline F1': benchmark.baseline_f1[idx] * 100,
    'Ensemble F1': benchmark.ensemble_f1[idx] * 100,
  }))

  const handleExport = () => {
    const headers = 'Threshold,Baseline Precision,Ensemble Precision,Baseline Recall,Ensemble Recall,Baseline F1,Ensemble F1'
    const rows = benchmark.thresholds.map((t, i) =>
      `${t.toFixed(2)},${benchmark.baseline_precision[i]},${benchmark.ensemble_precision[i]},${benchmark.baseline_recall[i]},${benchmark.ensemble_recall[i]},${benchmark.baseline_f1[i]},${benchmark.ensemble_f1[i]}`
    )
    const csv = `${headers}\n${rows.join('\n')}`
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.href = url
    a.download = 'benchmark_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Hero cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'False Positive Reduction', value: `${benchmark.false_positive_reduction_pct}%`, color: '#f44336', desc: 'At 0.50 threshold vs single-test Benford' },
          { label: 'Precision Lift', value: `+${benchmark.precision_lift_pct}%`, color: '#4caf50', desc: 'Average lift across all thresholds' },
          { label: 'Peak F1 Improvement', value: `+${((Math.max(...benchmark.ensemble_f1) - Math.max(...benchmark.baseline_f1)) * 100).toFixed(1)}pp`, color: '#00bcd4', desc: 'Ensemble maximum F1 vs baseline' },
        ].map(({ label, value, color, desc }) => (
          <Grid item xs={12} md={4} key={label}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
              <CardContent sx={{ py: '20px !important' }}>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>{label}</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color, my: 1 }}>{value}</Typography>
                <Typography variant="caption" sx={{ color: '#777', fontSize: '0.78rem' }}>{desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <WhiteChartCard
            title="Precision & Recall Curves"
            subtitle="Solid lines = Ensemble · Dashed lines = Naive single-test Benford baseline"
            footer="Solid Green = Ensemble Precision · Solid Blue = Ensemble Recall"
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prChartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="threshold" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
                <RTooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Baseline Precision" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Baseline Recall"    stroke="#bac7d5" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Ensemble Precision" stroke="#4caf50" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Ensemble Recall"    stroke="#2196f3" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </WhiteChartCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <WhiteChartCard
            title="F1 Score Lift Comparison"
            subtitle="Balances precision and recall (higher is better)"
            footer="Ensemble F1 (Purple) shows significant lift across all threshold ranges."
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={f1ChartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="threshold" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
                <RTooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Baseline F1" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Ensemble F1" fill="#9c27b0" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WhiteChartCard>
        </Grid>
      </Grid>

      {/* Comparison table */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', mb: 2, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Detailed Comparison Data</Typography>
              <Typography variant="body2" sx={{ color: '#999', fontSize: '0.8rem' }}>Ensemble performance compared to single-test Benford</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleExport} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>Export Data</Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: '#999', py: 1.5 } }}>
                  <TableCell>Threshold</TableCell>
                  <TableCell>Baseline Prec.</TableCell>
                  <TableCell>Ensemble Prec.</TableCell>
                  <TableCell>Baseline Recall</TableCell>
                  <TableCell>Ensemble Recall</TableCell>
                  <TableCell>Baseline F1</TableCell>
                  <TableCell>Ensemble F1</TableCell>
                  <TableCell>F1 Lift</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {benchmark.thresholds.map((t, idx) => {
                  const bf1 = benchmark.baseline_f1[idx] ?? 0
                  const ef1 = benchmark.ensemble_f1[idx] ?? 0
                  const lift = (ef1 - bf1) * 100
                  return (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                      <TableCell sx={{ py: 1, fontWeight: 700 }}>{t.toFixed(2)}</TableCell>
                      <TableCell sx={{ py: 1 }}>{((benchmark.baseline_precision[idx] ?? 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 600, color: '#4caf50' }}>{((benchmark.ensemble_precision[idx] ?? 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ py: 1 }}>{((benchmark.baseline_recall[idx] ?? 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 600, color: '#2196f3' }}>{((benchmark.ensemble_recall[idx] ?? 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ py: 1 }}>{bf1.toFixed(3)}</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 700 }}>{ef1.toFixed(3)}</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 700, color: lift > 0 ? '#4caf50' : '#f44336' }}>+{lift.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
