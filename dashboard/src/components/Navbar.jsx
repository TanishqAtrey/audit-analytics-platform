import { NavLink, useLocation } from 'react-router-dom'
import {
  AppBar, Toolbar, Typography, IconButton, Box, Breadcrumbs,
  Link, Avatar, Button,
} from '@mui/material'
import MenuIcon        from '@mui/icons-material/Menu'

const PAGE_LABELS = {
  '/dashboard':            'Ledger & Accounts Payable Overview',
  '/financial-dashboard':  'Corporate Financial Statements Overview',
  '/upload':               'Data Ingestion Portal',
  '/ledger':               'Ledger Exceptions Triage',
  '/financial':            'Financial Statement Exceptions',
  '/threshold':            'Threshold Explorer',
  '/benchmark':            'Benchmark Comparison',
  '/audit-log':            'Audit Trail',
  '/about':                'About & Methodology',
}

export default function Navbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const label = PAGE_LABELS[pathname] ?? 'AuditIQ'
  const isLedger = pathname === '/dashboard' || pathname === '/ledger' || pathname === '/upload'
  const isFinancial = pathname === '/financial-dashboard' || pathname === '/financial'

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        color: '#3c4858',
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Mobile menu */}
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Breadcrumb */}
        <Box sx={{ flexGrow: 1 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 0 }}>
            <Link underline="hover" color="inherit" href="#" sx={{ fontSize: '0.75rem', color: '#999' }}>
              Pages
            </Link>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#3c4858' }}>
              {label}
            </Typography>
          </Breadcrumbs>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
            {label}
          </Typography>
        </Box>

        {/* Domain Switcher Pills */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            bgcolor: 'rgba(0,0,0,0.05)',
            p: 0.5,
            borderRadius: 3,
            gap: 0.5,
          }}
        >
          <Button
            component={NavLink}
            to="/dashboard"
            size="small"
            sx={{
              borderRadius: 2.5,
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: isLedger ? 700 : 500,
              color: isLedger ? '#fff' : '#64748b',
              background: isLedger ? 'linear-gradient(195deg, #EC407A, #D81B60)' : 'transparent',
              boxShadow: isLedger ? '0 2px 8px 0 rgba(233,30,99,0.35)' : 'none',
              '&:hover': {
                background: isLedger ? 'linear-gradient(195deg, #EC407A, #D81B60)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            AP & Ledger
          </Button>

          <Button
            component={NavLink}
            to="/financial-dashboard"
            size="small"
            sx={{
              borderRadius: 2.5,
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: isFinancial ? 700 : 500,
              color: isFinancial ? '#fff' : '#64748b',
              background: isFinancial ? 'linear-gradient(195deg, #FFA726, #FB8C00)' : 'transparent',
              boxShadow: isFinancial ? '0 2px 8px 0 rgba(255,152,0,0.35)' : 'none',
              '&:hover': {
                background: isFinancial ? 'linear-gradient(195deg, #FFA726, #FB8C00)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            Corporate Financials
          </Button>
        </Box>




        {/* Avatar */}
        <Avatar
          sx={{ width: 32, height: 32, bgcolor: '#9c27b0', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          A
        </Avatar>
      </Toolbar>
    </AppBar>
  )
}
