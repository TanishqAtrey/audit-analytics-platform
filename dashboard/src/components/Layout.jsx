import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { LAYOUT } from '../config/constants'

const SIDEBAR_W = LAYOUT.SIDEBAR_WIDTH

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#eeeeee' }}>
      <Sidebar
        width={SIDEBAR_W}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { sm: `${SIDEBAR_W}px` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
