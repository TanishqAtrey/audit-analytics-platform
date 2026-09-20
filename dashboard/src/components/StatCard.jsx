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
export default function StatCard({ icon, iconColor, iconShadow, title, value, footer, trend, onClick, sx = {} }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: '12px',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,.08)',
        position: 'relative',
        overflow: 'visible',
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease' : 'none',
        border: '1px solid transparent',
        '&:hover': onClick ? {
          transform: 'translateY(-3px)',
          boxShadow: '0 8px 24px 0 rgba(0,0,0,.14)',
          borderColor: '#cbd5e1',
        } : {},
        ...sx,
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

      <CardContent sx={{ pt: 1, pb: '12px !important', px: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Value + label (right-aligned, icon takes up left) */}
        <Box sx={{ textAlign: 'right', pt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ color: '#999', fontWeight: 500, fontSize: '0.8rem', textTransform: 'none' }}
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

        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ my: 1.3 }} />

          {/* Footer row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
              {trend && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', color: trend.up ? '#4caf50' : '#f44336', flexShrink: 0 }}>
                  {trend.up
                    ? <ArrowUpwardIcon sx={{ fontSize: 13 }} />
                    : <ArrowDownwardIcon sx={{ fontSize: 13 }} />}
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.74rem' }}>
                    {trend.value}&nbsp;
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {footer}
              </Typography>
            </Box>
            {onClick && (
              <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                View Details →
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
