import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, TextField, FormControl, InputLabel,
  Select, MenuItem, OutlinedInput, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, CircularProgress, Alert, IconButton,
  Collapse, Tooltip, Stack, Paper, Divider
} from '@mui/material'
import {
  Download, Search, KeyboardArrowDown, KeyboardArrowUp,
  OpenInNew, Launch, Assessment, ReceiptLong, Tune,
  CloudUpload, ContentCopy
} from '@mui/icons-material'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid
} from 'recharts'

import { getAuditLog } from '../api/client'
import { WhiteChartCard } from '../components/ChartCard'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eee', borderRadius: 2, p: 1.5, boxShadow: 2 }}>
      <Typography variant="caption" fontWeight={700} display="block">{label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption">{p.name}: <b>{p.value}</b></Typography>
        </Box>
      ))}
    </Box>
  )
}

function RowItem({ row }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const isFinancial = useMemo(() => {
    const ds = (row.dataset || '').toLowerCase()
    const mod = (row.module || '').toLowerCase()
    return ds.includes('financial') || ds.includes('sec') || ds.includes('xbrl') || mod.includes('m-score') || mod.includes('z-score')
  }, [row.dataset, row.module])

  const handleOpenWindow = (path) => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(row.parameters, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <TableRow
        sx={{
          '&:hover': { bgcolor: '#f8fafc' },
          bgcolor: open ? '#f1f5f9' : 'inherit',
          transition: 'background-color 0.2s'
        }}
      >
        <TableCell sx={{ py: 1, px: 1, width: 48 }}>
          <Tooltip title={open ? "Hide Details" : "Show Full Run Details"}>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          </Tooltip>
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {new Date(row.timestamp).toLocaleString()}
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.8rem', fontWeight: 600 }}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {row.modules_list && row.modules_list.length > 0 ? (
              row.modules_list.map((m, i) => (
                <Chip
                  key={i}
                  label={m}
                  size="small"
                  sx={{
                    fontSize: '0.68rem',
                    height: 20,
                    bgcolor: isFinancial ? '#eff6ff' : '#f0fdf4',
                    color: isFinancial ? '#1d4ed8' : '#15803d',
                    border: '1px solid',
                    borderColor: isFinancial ? '#bfdbfe' : '#bbf7d0',
                    my: 0.2
                  }}
                />
              ))
            ) : (
              <Chip label={row.module} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
          </Stack>
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
          {row.dataset}
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.8rem' }}>
          {typeof row.threshold === 'number' ? row.threshold.toFixed(2) : row.threshold}
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
          {row.exceptions_found}
        </TableCell>
        <TableCell sx={{ py: 1.25, fontSize: '0.8rem', color: '#64748b' }}>
          {row.runtime_ms} ms
        </TableCell>
        <TableCell sx={{ py: 1.25 }}>
          <Chip label={row.run_by} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
        </TableCell>
        <TableCell sx={{ py: 1.25, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {isFinancial ? (
            <Tooltip title="Open Financial Statement Dashboard in new window">
              <Button
                size="small"
                variant="outlined"
                color="primary"
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                onClick={() => handleOpenWindow('/financial-dashboard')}
                sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.3, px: 1, borderRadius: 1.5 }}
              >
                Open FS Dash
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Open Ledger Dashboard in new window">
              <Button
                size="small"
                variant="outlined"
                color="primary"
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                onClick={() => handleOpenWindow('/dashboard')}
                sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.3, px: 1, borderRadius: 1.5 }}
              >
                Open Ledger
              </Button>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      {/* Expandable Details Row */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2.5, px: 3, my: 1, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tune sx={{ fontSize: 18, color: '#3b82f6' }} /> Execution Parameters & Model Config
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                      onClick={handleCopyJson}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', color: copied ? '#16a34a' : '#64748b' }}
                    >
                      {copied ? 'Copied JSON!' : 'Copy Config JSON'}
                    </Button>
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: '#0f172a',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      borderRadius: 1.5,
                      maxHeight: 180,
                      overflowY: 'auto'
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(row.parameters, null, 2)}
                    </pre>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Launch sx={{ fontSize: 18, color: '#8b5cf6' }} /> Launch Analysis in New Window
                  </Typography>

                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                    Open the targeted dashboard or exception worklist in a separate browser tab to cross-examine results side-by-side:
                  </Typography>

                  <Stack spacing={1}>
                    {isFinancial ? (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          startIcon={<Assessment />}
                          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                          onClick={() => handleOpenWindow('/financial-dashboard')}
                          sx={{ textTransform: 'none', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                        >
                          Launch Financial Statement Dashboard
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          startIcon={<ReceiptLong />}
                          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                          onClick={() => handleOpenWindow('/financial')}
                          sx={{ textTransform: 'none' }}
                        >
                          View Financial Exceptions Table
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          startIcon={<Assessment />}
                          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                          onClick={() => handleOpenWindow('/dashboard')}
                          sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                        >
                          Launch Ledger Overview Dashboard
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          startIcon={<ReceiptLong />}
                          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                          onClick={() => handleOpenWindow('/ledger')}
                          sx={{ textTransform: 'none' }}
                        >
                          View Ledger Exceptions Table
                        </Button>
                      </>
                    )}

                    <Button
                      variant="text"
                      size="small"
                      fullWidth
                      startIcon={<CloudUpload />}
                      endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                      onClick={() => handleOpenWindow('/upload')}
                      sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.75rem' }}
                    >
                      Open Data Ingestion Portal
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

export default function AuditLog() {
  const [logRows, setLogRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState([])
  const [moduleFilter, setModuleFilter] = useState([])

  useEffect(() => {
    let mounted = true
    getAuditLog(100).then(data => {
      if (mounted) {
        setLogRows(data || [])
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const uniqueUsers = useMemo(() => [...new Set(logRows.map(r => r.run_by))].sort(), [logRows])
  const uniqueModules = useMemo(() => [...new Set(logRows.map(r => r.module))].sort(), [logRows])

  const filteredLogs = useMemo(() => {
    let list = [...logRows]
    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter(r => (r.dataset || '').toLowerCase().includes(term) || (r.module || '').toLowerCase().includes(term))
    }
    if (userFilter.length) {
      list = list.filter(r => userFilter.includes(r.run_by))
    }
    if (moduleFilter.length) {
      list = list.filter(r => moduleFilter.includes(r.module))
    }
    return list
  }, [logRows, search, userFilter, moduleFilter])

  const chartData = useMemo(() => {
    return [...logRows].slice(0, 15).reverse().map(r => ({
      name: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      'Exceptions': r.exceptions_found,
      'Runtime (ms)': r.runtime_ms,
    }))
  }, [logRows])

  const handleExport = () => {
    const esc = s => `"${String(s || '').replace(/"/g, '""')}"`
    const headers = 'id,timestamp,module,dataset,threshold,exceptions_found,runtime_ms,run_by'
    const rows = filteredLogs.map(r =>
      `${r.id},${esc(r.timestamp)},${esc(r.module)},${esc(r.dataset)},${r.threshold},${r.exceptions_found},${r.runtime_ms},${esc(r.run_by)}`
    )
    const csv = `${headers}\n${rows.join('\n')}`
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.href = url
    a.download = 'audit_log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openNewWindow = (path) => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 4 }}>
      {/* Quick Launch Hub */}
      <Card sx={{ mb: 3, borderRadius: '12px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
        <CardContent sx={{ py: 2.5, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1 }}>
                Multi-Window Analysis Workspace
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.82rem', mt: 0.5 }}>
                Launch dedicated dashboards in separate browser windows to monitor live ledgers, XBRL filings, and anomaly graphs simultaneously.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                startIcon={<Assessment />}
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                onClick={() => openNewWindow('/dashboard')}
                sx={{
                  bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2563eb' },
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: 2
                }}
              >
                Ledger Dashboard ↗
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Assessment />}
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                onClick={() => openNewWindow('/financial-dashboard')}
                sx={{
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: 2
                }}
              >
                Financial Dashboard ↗
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUpload />}
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                onClick={() => openNewWindow('/upload')}
                sx={{
                  color: '#e2e8f0',
                  borderColor: '#475569',
                  '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)' },
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderRadius: 2
                }}
              >
                Ingest Portal ↗
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Upper chart cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={7}>
          <WhiteChartCard
            title="Exceptions Found Timeline"
            subtitle="Anomaly detection count per operational run"
            footer="Last 15 pipeline logs displayed"
            height={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGradPink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e91e63" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#e91e63" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
                <RTooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="Exceptions" stroke="#e91e63" strokeWidth={2.5} fill="url(#areaGradPink)" />
              </AreaChart>
            </ResponsiveContainer>
          </WhiteChartCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <WhiteChartCard
            title="Module Executions Runtimes"
            subtitle="Latency measurement in milliseconds (ms)"
            footer="Execution speed metrics"
            height={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} stroke="#cbd5e1" />
                <RTooltip content={<DarkTooltip />} />
                <Bar dataKey="Runtime (ms)" fill="#9c27b0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WhiteChartCard>
        </Grid>
      </Grid>

      {/* Compliance banner */}
      <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Compliance & Traceability:</strong> This audit trail logs all analytical procedures automatically to satisfy SOX/PCAOB section 404 requirements. Click any row below to inspect full execution JSON and open target views.
      </Alert>

      {/* Filter and Log Table */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Historical Audit Log & Execution History</Typography>
              <Typography variant="body2" sx={{ color: '#999', fontSize: '0.8rem' }}>Total of {filteredLogs.length} runs catalogued — click arrow on any row to expand details</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleExport} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>Export Log</Button>
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                size="small"
                fullWidth
                label="Search by Dataset or Module"
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: '#bbb', mr: 0.5 }} /> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Filter Operator</InputLabel>
                <Select
                  multiple
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  input={<OutlinedInput label="Filter Operator" />}
                  renderValue={sel => sel.join(', ')}
                >
                  {uniqueUsers.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Filter Module</InputLabel>
                <Select
                  multiple
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value)}
                  input={<OutlinedInput label="Filter Module" />}
                  renderValue={sel => sel.join(', ')}
                >
                  {uniqueModules.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: '#999', py: 1.5 } }}>
                  <TableCell sx={{ width: 48 }}></TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Module / Tests</TableCell>
                  <TableCell>Dataset</TableCell>
                  <TableCell>Threshold</TableCell>
                  <TableCell>Exceptions</TableCell>
                  <TableCell>Runtime</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map(r => (
                  <RowItem key={r.id} row={r} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
