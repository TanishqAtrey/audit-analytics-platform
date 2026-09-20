import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, useTheme,
} from '@mui/material'
import DashboardIcon    from '@mui/icons-material/Dashboard'
import TableChartIcon   from '@mui/icons-material/TableChart'
import BarChartIcon     from '@mui/icons-material/BarChart'
import TuneIcon         from '@mui/icons-material/Tune'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import HistoryIcon      from '@mui/icons-material/History'
import InfoIcon         from '@mui/icons-material/Info'
import SearchIcon       from '@mui/icons-material/Search'
import CloudUploadIcon  from '@mui/icons-material/CloudUpload'

const NAV_GROUPS = [
  {
    title: 'ACCOUNTS PAYABLE & LEDGER',
    items: [
      { to: '/dashboard', label: 'Ledger Overview', icon: <DashboardIcon />, color: '#9c27b0' },
      { to: '/ledger', label: 'Ledger Exceptions', icon: <TableChartIcon />, color: '#f44336' },
      { to: '/upload?tab=ledger', label: 'Upload Ledger CSV', icon: <CloudUploadIcon />, color: '#03a9f4' },
    ]
  },
  {
    title: 'CORPORATE FINANCIALS',
    items: [
      { to: '/financial-dashboard', label: 'Statement Overview', icon: <BarChartIcon />, color: '#ff9800' },
      { to: '/financial', label: 'Financial Exceptions', icon: <TableChartIcon />, color: '#e91e63' },
    ]
  },
  {
    title: 'PLATFORM TOOLS',
    items: [
      { to: '/threshold', label: 'Threshold Explorer', icon: <TuneIcon />, color: '#4caf50' },
      { to: '/benchmark', label: 'Benchmark Engine', icon: <CompareArrowsIcon />, color: '#00bcd4' },
      { to: '/audit-log', label: 'Run History & Logs', icon: <HistoryIcon />, color: '#7c4dff' },
      { to: '/about', label: 'Methodology', icon: <InfoIcon />, color: '#607d8b' },
    ]
  }
]

import { APP_META } from '../config/constants'

function SidebarContent({ onClose }) {
  const { pathname } = useLocation()

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'linear-gradient(195deg, #42424a, #191919)',
        color: '#fff',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 3, py: 3,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Box
          sx={{
            width: 36, height: 36, borderRadius: '8px',
            background: 'linear-gradient(195deg, #EC407A, #D81B60)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(233,30,99,.4)',
          }}
        >
          <SearchIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
            AuditIQ
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
            Analytics Platform
          </Typography>
        </Box>
      </Box>

      {/* Nav */}
      <Box sx={{ px: 2, py: 1.5, flexGrow: 1, overflowY: 'auto' }}>
        {NAV_GROUPS.map((group, gIdx) => (
          <Box key={gIdx} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                px: 2, py: 0.5, display: 'block',
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase'
              }}
            >
              {group.title}
            </Typography>
            <List disablePadding>
              {group.items.map(({ to, label, icon, color }) => {
                const toPath = to.split('?')[0]
                const active = pathname === toPath || pathname.startsWith(toPath + '/')
                return (
                  <ListItem key={to} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={NavLink}
                      to={to}
                      onClick={onClose}
                      sx={{
                        borderRadius: '8px',
                        px: 2, py: 0.75,
                        transition: 'all 0.2s ease',
                        '&:hover': { background: 'rgba(255,255,255,0.08)' },
                        ...(active && {
                          background: 'rgba(255,255,255,0.1)',
                          boxShadow: `0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px ${color}80`,
                        }),
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                          sx={{
                            width: 28, height: 28, borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: active
                              ? `linear-gradient(195deg, ${color}cc, ${color})`
                              : 'rgba(255,255,255,0.1)',
                            boxShadow: active
                              ? `0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px ${color}50`
                              : 'none',
                            transition: 'all 0.2s ease',
                            '& svg': { fontSize: 15, color: '#fff' },
                          }}
                        >
                          {icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                          fontSize: '0.8rem',
                          fontWeight: active ? 700 : 400,
                          color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
          {`${APP_META.TITLE} · v${APP_META.VERSION}`}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', mt: 0.3 }}>
          All data public · No PII
        </Typography>
      </Box>
    </Box>
  )
}

export default function Sidebar({ width, mobileOpen, onClose }) {
  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width, border: 'none' },
        }}
      >
        <SidebarContent onClose={onClose} />
      </Drawer>
      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            width, border: 'none', overflow: 'hidden',
            boxShadow: '0 10px 30px -12px rgba(0,0,0,.42),0 4px 25px 0 rgba(0,0,0,.12),0 8px 10px -5px rgba(0,0,0,.2)',
          },
        }}
        open
      >
        <SidebarContent onClose={onClose} />
      </Drawer>
    </>
  )
}
