import React from 'react'
import { Chip } from '@mui/material'

const STATUS_MAP = {
  unreviewed:     { label: 'Unreviewed',    color: 'info'    },
  confirmed:      { label: 'Confirmed',     color: 'error'   },
  false_positive: { label: 'False Positive',color: 'success' },
  needs_review:   { label: 'Needs Review',  color: 'warning' },
}

export function StatusChip({ status }) {
  const { label, color } = STATUS_MAP[status] ?? { label: status, color: 'default' }
  return <Chip label={label} color={color} size="small" variant="filled" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
}

const SEVERITY_MAP = [
  { min: 0.80, label: 'Critical', color: 'error'   },
  { min: 0.60, label: 'High',     color: 'warning' },
  { min: 0.40, label: 'Medium',   color: 'info'    },
  { min: 0,    label: 'Low',      color: 'success' },
]

export function SeverityChip({ score }) {
  const { label, color } = SEVERITY_MAP.find(s => score >= s.min) ?? SEVERITY_MAP[3]
  return <Chip label={label} color={color} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
}
