import React from 'react'
import { Box, Card, CardContent, Typography, Divider } from '@mui/material'

/**
 * Coloured card that contains a Recharts chart.
 * The header has the coloured gradient background; chart sits inside.
 */
export default function ChartCard({ color, shadow, title, subtitle, footer, children, headerHeight = 200 }) {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: shadow ?? '0 2px 12px 0 rgba(0,0,0,.08)',
        overflow: 'visible',
      }}
    >
      {/* Coloured chart header */}
      <Box
        sx={{
          mx: 2,
          mt: -3,
          borderRadius: '10px',
          background: color,
          boxShadow: shadow,
          height: headerHeight,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </Box>

      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#3c4858' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: '#999', fontSize: '0.8rem', mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
        {footer && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.78rem' }}>
              {footer}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Clean, high-contrast chart card layout for complex multivariate data views.
 * Bypasses colored background headers for readability.
 */
export function WhiteChartCard({ title, subtitle, footer, children, height = 260 }) {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,.06)',
        border: '1px solid #eef0f2',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 2.5, pb: '16px !important' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.3 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ height, width: '100%', mb: 1.5 }}>
          {children}
        </Box>

        {footer && (
          <>
            <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>
              {footer}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
