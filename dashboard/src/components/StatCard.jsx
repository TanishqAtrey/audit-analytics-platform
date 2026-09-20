import React from 'react'
import { Box, Card, CardContent, Typography, Divider } from '@mui/material'
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'

/**
 * Material Dashboard React-style stat card.
 *
 * Props:
 *   icon      – MUI icon element
 *   iconColor – gradient colour string, e.g. 'linear-gradient(195deg,#EC407A,#D81B60)'
 *   iconShadow– box-shadow string for the floating icon box
 *   title     – top label (small, grey)
 *   value     – big bold number/text
 *   footer    – bottom text (last updated / source label)
 *   trend     – optional { value: '+12%', up: true }
 */
export default function StatCard({ icon, iconColor, iconShadow, title, value, footer, trend }) {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {/* Floating icon box */}
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          left: 20,
          width: 64,
          height: 64,
          borderRadius: '12px',
          background: iconColor,
          boxShadow: iconShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': { color: '#fff', fontSize: 32 },
        }}
      >
        {icon}
      </Box>

      <CardContent sx={{ pt: 1, pb: '12px !important', pl: 2, pr: 2 }}>
        {/* Value + label (right-aligned, icon takes up left) */}
        <Box sx={{ textAlign: 'right', pt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ color: '#999', fontWeight: 400, fontSize: '0.8rem', textTransform: 'none' }}
          >
            {title}
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#3c4858', lineHeight: 1.2, mt: 0.3 }}
          >
            {value}
          </Typography>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Footer row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', color: trend.up ? '#4caf50' : '#f44336' }}>
              {trend.up
                ? <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                {trend.value}&nbsp;
              </Typography>
            </Box>
          )}
          <Typography variant="caption" sx={{ color: '#999', fontSize: '0.78rem' }}>
            {footer}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
