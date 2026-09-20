import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import FinancialDashboard from './pages/FinancialDashboard'
import LedgerExceptions from './pages/LedgerExceptions'
import FinancialExceptions from './pages/FinancialExceptions'
import ThresholdExplorer from './pages/ThresholdExplorer'
import BenchmarkComparison from './pages/BenchmarkComparison'
import AuditLog from './pages/AuditLog'
import About from './pages/About'
import UploadData from './pages/UploadData'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="upload"              element={<UploadData />} />
              <Route path="dashboard"           element={<Dashboard />} />
              <Route path="financial-dashboard" element={<FinancialDashboard />} />
              <Route path="ledger"              element={<LedgerExceptions />} />
              <Route path="financial"           element={<FinancialExceptions />} />
              <Route path="threshold"   element={<ThresholdExplorer />} />
              <Route path="benchmark"   element={<BenchmarkComparison />} />
              <Route path="audit-log"   element={<AuditLog />} />
              <Route path="about"       element={<About />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
