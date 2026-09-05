'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export type StatusType = 'unreviewed' | 'confirmed' | 'false_positive' | 'needs_review';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  unreviewed: { label: 'Unreviewed', className: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'Confirmed Fraud', className: 'bg-red-100 text-red-700' },
  false_positive: { label: 'False Positive', className: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unreviewed;

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
