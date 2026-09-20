import React, { useState } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, Button,
  Checkbox, FormControlLabel, CircularProgress, Alert, Divider,
  Paper, Stack, Chip,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ListAltIcon from '@mui/icons-material/ListAlt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

import { uploadLedgerCsv, uploadFinancialStatementCsv, triggerDetectionRun, resetPlatformData, runBenchmark } from '../api/client'
import { DEFAULTS } from '../config/constants'

export default function UploadData() {
  // Ledger Upload State
  const [selectedFile, setSelectedFile]       = useState(null)
  const [isDragging, setIsDragging]           = useState(false)
  const [detectedType, setDetectedType]       = useState(null)
  const [detectedCols, setDetectedCols]       = useState([])
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [uploading, setUploading]             = useState(false)
  const [uploadResult, setUploadResult]       = useState(null)
  const [uploadError, setUploadError]         = useState(null)
  const [resetting, setResetting]             = useState(false)
  const [resetSuccess, setResetSuccess]       = useState(null)

  // Smart Schema Auto-Inspection on File Selection
  const inspectFile = (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setUploadError('Only CSV files are accepted.')
      setSelectedFile(null)
      setDetectedType(null)
      return
    }

    setSelectedFile(file)
    setUploadError(null)
    setUploadResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result || ''
      const firstLine = text.split('\n')[0] || ''
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
      setDetectedCols(headers)

      const isLedgerMatch = headers.includes('vendor') || headers.includes('amount') || headers.includes('invoice_number')
      const isStatementMatch = headers.includes('ticker') || headers.includes('fiscal_year') || headers.includes('revenue') || headers.includes('net_income')

      if (isLedgerMatch) {
        setDetectedType('ledger')
      } else if (isStatementMatch) {
        setDetectedType('statements')
      } else {
        setDetectedType('generic')
      }
    }
    reader.readAsText(file.slice(0, 4096))
  }

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) inspectFile(file)
  }

  // Drag-and-Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) inspectFile(file)
  }

  // Handle file upload & analysis
  const handleUploadFile = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    setResetSuccess(null)
    
    if (detectedType === 'statements') {
      const result = await uploadFinancialStatementCsv(selectedFile, replaceExisting)
      if (!result) {
        setUploading(false)
        setUploadError('Financial statement ingestion failed. Backend server may be offline or returned validation errors.')
        return
      }

      const runResult = await triggerDetectionRun('financial_statement', DEFAULTS.FS_DETECTION_THRESHOLD, result.dataset_id)
      setUploading(false)
      if (runResult) {
        setUploadResult({
          ...result,
          total_exceptions: runResult.total_exceptions
        })
        runBenchmark('financial_statement', result.dataset_id).catch(() => {})
      } else {
        setUploadError('Financial statements ingested successfully, but failed to run the anomaly detection models.')
      }
    } else {
      // Step 1: Upload (with replaceExisting option)
      const result = await uploadLedgerCsv(selectedFile, replaceExisting)
      if (!result) {
        setUploading(false)
        setUploadError('Ingestion failed. Backend server may be offline or returned validation errors.')
        return
      }
      
      // Step 2: Trigger Detection Engine Core
      const runResult = await triggerDetectionRun('ledger', DEFAULTS.DETECTION_THRESHOLD, result.dataset_id)
      setUploading(false)
      if (runResult) {
        setUploadResult({
          ...result,
          total_exceptions: runResult.total_exceptions
        })
        // Automatically compute benchmark comparisons in background
        runBenchmark('ledger', result.dataset_id).catch(() => {})
      } else {
        setUploadError('CSV ingested successfully, but failed to run the anomaly detection models.')
      }
    }
  }

  // Handle Full Platform Reset
  const handleResetPlatform = async () => {
    if (!window.confirm('Are you sure you want to reset all platform data to 0? This will remove all previously uploaded transactions, financial statements, and flagged exceptions so you can start fresh.')) {
      return
    }
    setResetting(true)
    setResetSuccess(null)
    setUploadError(null)
    setUploadResult(null)
    setSelectedFile(null)
    setDetectedType(null)


    const res = await resetPlatformData()
    setResetting(false)
    if (res) {
      setResetSuccess('Platform reset complete! All datasets and flagged exceptions have been cleared to 0.')
    } else {
      setUploadError('Failed to reset platform data. Please check backend connection.')
    }
  }






  return (
    <Box sx={{ mt: 4 }}>
      {/* Title Header Card */}
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', mb: 3 }}>
        <CardContent sx={{ pb: '0 !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 1 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Data Ingestion Portal</Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>
              Provide transaction ledger CSV files for AI-powered fraud and anomaly detection.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleResetPlatform}
              disabled={resetting}
              startIcon={resetting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              {resetting ? 'Resetting...' : 'Reset Platform to 0'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Ingest Ledger CSV */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, fontSize: '1.1rem' }}>
                    Data File Ingestion (Ledgers & Financial Statements)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Upload Accounts Payable ledger CSVs or multi-company financial statement CSVs for forensic anomaly and fraud detection.
                  </Typography>
                </Box>

                {resetSuccess && (
                  <Alert severity="success" onClose={() => setResetSuccess(null)} sx={{ mb: 2, borderRadius: 2, py: 0.5 }}>
                    {resetSuccess}
                  </Alert>
                )}
                
                {/* Upload Zone */}
                <Box
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  sx={{
                    border: `2px dashed ${selectedFile ? '#4caf50' : isDragging ? '#9c27b0' : '#cbd5e1'}`,
                    borderRadius: 3,
                    py: 2.5,
                    px: 3,
                    textAlign: 'center',
                    bgcolor: selectedFile ? '#f0fdf4' : isDragging ? '#faf5ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: '#9c27b0', bgcolor: '#faf5ff' },
                    mb: 2
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={handleFileChange}
                  />
                  <CloudUploadIcon sx={{ fontSize: 40, color: selectedFile ? '#16a34a' : isDragging ? '#9c27b0' : '#64748b', mb: 0.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: selectedFile ? '#15803d' : '#1e293b' }}>
                    {selectedFile ? selectedFile.name : 'Click to browse or drag & drop CSV file'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25, fontSize: '0.75rem' }}>
                    {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB · File ready for ingestion` : 'Accepted format: .csv with headers (vendor, amount, invoice_number, date)'}
                  </Typography>
                </Box>

                {/* Smart Schema Recognition Badge */}
                {selectedFile && detectedType && (
                  <Box sx={{ mb: 2, p: 1.25, bgcolor: '#f1f5f9', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                      <AutoAwesomeIcon fontSize="small" sx={{ color: detectedType === 'ledger' ? '#9c27b0' : '#0284c7' }} />
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#1e293b' }}>
                        Auto-Detected File Format:
                      </Typography>
                      <Chip
                        label={
                          detectedType === 'ledger' ? 'Accounts Payable Ledger' :
                          detectedType === 'statements' ? 'Financial Statements (XBRL)' :
                          'Custom CSV Data'
                        }
                        size="small"
                        color={detectedType === 'ledger' ? 'secondary' : detectedType === 'statements' ? 'info' : 'default'}
                        sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem' }}
                      />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                      Recognized columns: {detectedCols.slice(0, 6).join(', ')}{detectedCols.length > 6 ? ` (+${detectedCols.length - 6} more)` : ''}
                    </Typography>
                  </Box>
                )}

                {/* Replace Existing Checkbox */}
                <Box sx={{ mb: 2.5, px: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                        color="secondary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                        Clean start: Replace prior dataset with this upload (Start from 0 count)
                      </Typography>
                    }
                  />
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', ml: 3.5, mt: -0.5, fontSize: '0.72rem' }}>
                    Clears previous transactions so dashboard and exception tables reflect only this file.
                  </Typography>
                </Box>

                {uploadError && (
                  <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{uploadError}</Alert>
                )}

                {/* Primary CTA Button */}
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleUploadFile}
                  disabled={!selectedFile || uploading}
                  size="large"
                  sx={{
                    py: 1.25,
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    borderRadius: 2.5,
                    background: selectedFile ? 'linear-gradient(195deg, #EC407A, #D81B60)' : '#cbd5e1',
                    color: selectedFile ? '#fff' : '#64748b',
                    boxShadow: selectedFile ? '0 4px 14px 0 rgba(233,30,99,0.35)' : 'none',
                    textTransform: 'none',
                    mb: 2,
                    '&:hover': {
                      background: selectedFile ? 'linear-gradient(195deg, #D81B60, #C2185B)' : '#cbd5e1',
                    }
                  }}
                >
                  {uploading ? (
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                      <CircularProgress size={18} color="inherit" />
                      <span>Ingesting & Executing Detection Pipeline...</span>
                    </Stack>
                  ) : selectedFile ? (
                    `Ingest & Analyze ${selectedFile.name}`
                  ) : (
                    'Select a CSV File to Ingest'
                  )}
                </Button>

                <Divider sx={{ my: 1.5 }} />

                {/* Secondary Auxiliary Controls */}
                <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Stack direction="row" spacing={1}>

                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleResetPlatform}
                      disabled={resetting}
                      startIcon={resetting ? <CircularProgress size={12} color="inherit" /> : <RestartAltIcon sx={{ fontSize: 14 }} />}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, fontSize: '0.75rem' }}
                    >
                      Reset to 0
                    </Button>
                  </Stack>
                  
                  {selectedFile && (
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={() => { setSelectedFile(null); setDetectedType(null); const inp = document.querySelector('input[type="file"]'); if (inp) inp.value = ''; }}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#64748b' }}
                    >
                      Clear Selection
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', mb: 2 }}>
                  Ingestion Results
                </Typography>
                
                {uploadResult ? (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, color: '#4caf50' }}>
                      <CheckCircleIcon />
                      <Typography variant="subtitle1" fontWeight={700}>Ingestion Successful!</Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Dataset ID:</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 0.5, borderRadius: 1, display: 'block', mb: 2.5 }}>
                      {uploadResult.dataset_id}
                    </Typography>

                    <Grid container spacing={1.5} sx={{ mb: 3 }}>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                          <Typography variant="h6" fontWeight={800} color="#9c27b0">{uploadResult.rows_ingested}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.2 }}>Rows Loaded</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                          <Typography variant="h6" fontWeight={800} color="#00bcd4">{uploadResult.companies_detected !== undefined ? uploadResult.companies_detected : uploadResult.vendors_detected}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.2 }}>{uploadResult.companies_detected !== undefined ? 'Companies' : 'Vendors'}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                          <Typography variant="h6" fontWeight={800} color="#d32f2f">{uploadResult.total_exceptions ?? 0}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.2 }}>Exceptions</Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Button
                      variant="contained"
                      fullWidth
                      href={uploadResult.companies_detected !== undefined ? "/financial" : "/ledger"}
                      sx={{
                        mb: 2,
                        py: 1,
                        fontWeight: 700,
                        textTransform: 'none',
                        borderRadius: 2,
                        bgcolor: uploadResult.companies_detected !== undefined ? '#ed6c02' : '#9c27b0',
                        '&:hover': {
                          bgcolor: uploadResult.companies_detected !== undefined ? '#e65100' : '#7b1fa2',
                        }
                      }}
                    >
                      {uploadResult.companies_detected !== undefined ? 'View Financial Statement Exceptions' : 'View Ledger Exceptions'}
                    </Button>

                    {uploadResult.warnings?.length > 0 && (
                      <Box sx={{ bgcolor: '#fffde7', border: '1px solid #fff59d', borderRadius: 2, p: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#f57c00', mb: 1 }}>
                          <WarningAmberIcon fontSize="small" />
                          <Typography variant="caption" fontWeight={700}>Ingestion Warnings</Typography>
                        </Stack>
                        <ul style={{ paddingLeft: 16, margin: 0 }}>
                          {uploadResult.warnings.slice(0, 3).map((w, idx) => (
                            <li key={idx}><Typography variant="caption" color="text.secondary">{w}</Typography></li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#bbb', py: 4 }}>
                    <ListAltIcon sx={{ fontSize: 64, mb: 1 }} />
                    <Typography variant="body2">No ledger uploaded yet.</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>



    </Box>
  )
}
