import React, { useState } from 'react'
import {
  Box, Tabs, Tab, Typography, Card, CardContent, Grid, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Accordion, AccordionSummary, AccordionDetails, Stack
} from '@mui/material'
import { ExpandMore, CheckCircle, Cancel, Security } from '@mui/icons-material'

export default function About() {
  const [tabIdx, setTabIdx] = useState(0)

  return (
    <Box sx={{ mt: 4 }}>
      <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)', mb: 3 }}>
        <CardContent sx={{ pb: '0 !important' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>About &amp; Methodology</Typography>
          <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>Technical documentation, architecture layout, algorithmic models, and scope boundaries.</Typography>
          <Tabs
            value={tabIdx}
            onChange={(_, val) => setTabIdx(val)}
            textColor="secondary"
            indicatorColor="secondary"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Architecture" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Detection Methods" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Data Sources" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Scope &amp; Limits" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        </CardContent>
      </Card>

      {/* Tab Panels */}
      {tabIdx === 0 && (
        <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>System Architecture Diagram</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', bgcolor: '#fafafa', p: 3, borderRadius: 2, mb: 4, border: '1px solid #eee' }}>
              <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #9c27b0', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>React / Vite Frontend</Typography>
                <Typography variant="caption" color="text.secondary">Material Dashboard style</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#bbb' }}>→</Typography>
              <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #f44336', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>FastAPI Backend</Typography>
                <Typography variant="caption" color="text.secondary">Endpoints / routing / CORS</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#bbb' }}>→</Typography>
              <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #4caf50', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Detection Core</Typography>
                <Typography variant="caption" color="text.secondary">Scorer, Registry, Reason engine</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#bbb' }}>→</Typography>
              <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #2196f3', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>PostgreSQL Database</Typography>
                <Typography variant="caption" color="text.secondary">Raw tables, case statuses</Typography>
              </Box>
            </Box>

            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Shared Core &amp; Domain Adapters Design</Typography>
            <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.8, mb: 3 }}>
              AuditIQ relies on a <strong>"one core, two adapters"</strong> architecture. The core scoring and explainability engine processes general anomalies, while thin domain-specific adapters reshape input datasets (Ledger transaction logs and Financial Statement facts) to plug into the core. This keeps validation logic modular, scalable, and easy to maintain.
            </Typography>

            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Technology Stack Specifications</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 700 } }}>
                    <TableCell>Layer</TableCell>
                    <TableCell>Technology</TableCell>
                    <TableCell>Description / Choice Rationale</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    { l: 'Frontend UI', t: 'React, Vite, MUI v5, Recharts', d: 'Fast, modular client-side routing, professional typography, Recharts responsive widgets' },
                    { l: 'Backend Service', t: 'FastAPI (Python 3.11), Pydantic', d: 'Async, high-speed request validation, auto-generated Swagger schema documentation' },
                    { l: 'Database Store', t: 'PostgreSQL 16 (Dockerised)', d: 'Robust ACID compliance, concurrent case-status updates, audit log indexes' },
                    { l: 'Database Interface', t: 'SQLAlchemy / SQLModel', d: 'Consistent declarative mapping, preventing raw queries scattered in backend adapters' },
                    { l: 'Fuzzy Matching', t: 'RapidFuzz', d: 'C-compiler free fuzzy invoice/vendor comparison, blocking matches for O(N log N) scaling' },
                    { l: 'Anomalies Engine', t: 'scikit-learn (Isolation Forest & LOF)', d: 'Lightweight density-based and partition-based outlier evaluation' }
                  ].map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 700, py: 1.25 }}>{row.l}</TableCell>
                      <TableCell sx={{ py: 1.25 }}><Chip label={row.t} size="small" color="secondary" variant="outlined" /></TableCell>
                      <TableCell sx={{ py: 1.25, color: '#666' }}>{row.d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tabIdx === 1 && (
        <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>Detection Methodologies</Typography>
            {[
              {
                title: "Benford's Law Ensemble",
                desc: "Evaluates deviations of first-digit, second-digit, and first-two-digit frequencies in transactional datasets compared to the logarithmic Benford probability distribution. Combined with Mean Absolute Deviation (MAD) and chi-square goodness-of-fit to output a normalised ensemble score."
              },
              {
                title: "Duplicate Invoice Detection",
                desc: "Matches transactions based on fuzzy vendor names and exact invoice values/dates. Implements a blocking index step to narrow comparisons, avoiding O(N²) all-pairs quadratic scaling bottlenecks. Utilises token-set-ratio matching algorithm."
              },
              {
                title: "Three-Way Match (PO-Invoice-GR)",
                desc: "Compares Purchase Orders (PO), Invoices, and Goods Receipts (GR) matching lines. Flags missing matches, over-billing margins, or dates out of order. Labelled as synthetic data verification."
              },
              {
                title: "Beneish M-Score",
                desc: "Determines likelihood of earnings manipulation through an eight-variable parametric mathematical formula (Beneish 1999) using DSRI, GMI, AQI, SGI, DEPI, SGAI, LVGI, TATA parameters."
              },
              {
                title: "Altman Z-Score",
                desc: "Calculates corporate insolvency risk utilizing a five-factor discriminant equation (Altman 1968) using ratios based on working capital, retained earnings, EBIT, equity capitalization, and turnover."
              },
              {
                title: "Isolation Forest & Local Outlier Factor (LOF)",
                desc: "Unsupervised machine learning methods from scikit-learn. Isolation Forest isolates anomalies by randomly partitioning feature paths. Local Outlier Factor calculates the local density deviation of a transaction relative to its neighbors."
              }
            ].map((m, idx) => (
              <Accordion key={idx} sx={{ mb: 1, border: '1px solid #eee', boxShadow: 'none', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3c4858' }}>{m.title}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: '#fafafa', borderTop: '1px solid #eee' }}>
                  <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.8 }}>{m.desc}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}

      {tabIdx === 2 && (
        <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Public Datasets Catalog</Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
              AuditIQ relies entirely on <strong>public domain</strong> datasets. It does not ingest or store any Personally Identifiable Information (PII) or confidential client data.
            </Typography>
            <Grid container spacing={2}>
              {[
                { name: 'SEC EDGAR XBRL API', type: 'Financial Statements', details: 'Used to pull financial metrics for a curated list of ~40 SEC-registered corporations (clean and fraudulent cases).' },
                { name: 'USASpending.gov', type: 'Procurement Transactions', details: 'Utilized as raw operational data for vendor transactions to backtest duplicate matching and statistical anomalies.' },
                { name: 'SEC AAER Releases', type: 'Ground Truth Labels', details: 'SEC Accounting and Auditing Enforcement Releases used to validate the M-Score and Z-Score precision/recall outcomes.' },
                { name: 'Kaggle Fraud Logs', type: 'Cross-Domain Anomaly', details: 'Credit card transaction logs used for cross-validation to demonstrate how the Isolation Forest models generalize.' }
              ].map((src, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>{src.name}</Typography>
                        <Chip label={src.type} size="small" color="secondary" />
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#777', fontSize: '0.8rem', lineHeight: 1.6 }}>{src.details}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {tabIdx === 3 && (
        <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)' }}>
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#4caf50' }}>
                  <CheckCircle />
                  <Typography variant="h6" fontWeight={700}>What IS Built &amp; Validated</Typography>
                </Box>
                <ul style={{ color: '#555', fontSize: '0.85rem', lineHeight: 2, paddingLeft: 20 }}>
                  <li>Benford Ensemble statistical calculation core</li>
                  <li>Fuzzy duplicate invoice matching with RapidFuzz</li>
                  <li>3-way matching rules on synthetically generated lines</li>
                  <li>Altman Z-Score and Beneish M-Score calculations</li>
                  <li>Unsupervised Isolation Forest + LOF feature outliers</li>
                  <li>Interactive parameter/threshold tuning slider</li>
                  <li>Case status updates (confirmed, false positive, review)</li>
                  <li>Compliance-approved automated audit logging</li>
                </ul>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#f44336' }}>
                  <Cancel />
                  <Typography variant="h6" fontWeight={700}>What is OUT OF SCOPE</Typography>
                </Box>
                <ul style={{ color: '#555', fontSize: '0.85rem', lineHeight: 2, paddingLeft: 20 }}>
                  <li>No generic SEC EDGAR ticker parsing (fixed curated list only)</li>
                  <li>No enterprise auth/RBAC or single sign-on mechanisms</li>
                  <li>No PII or private client database ingestion models</li>
                  <li>No cloud microservice orchestration (laptop Docker environment)</li>
                  <li>No model explainability packages like SHAP (rule-based weights only)</li>
                  <li>No database encryption-at-rest implementations</li>
                </ul>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, p: 2.5, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #eee' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#1976d2' }}>
                <Security fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700}>Security &amp; Secret Stance</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.6 }}>
                All sensitive API configuration parameters and Postgres logins are held in standard <code>.env</code> file containers, validated by <code>data_infra/security/env_validation.py</code>. User-uploaded files are processed by <code>input_sanitization.py</code> to ensure robust, threat-resistant ingestion boundaries.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
