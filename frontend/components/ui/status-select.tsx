'use client';
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { showSuccess, showError } from './toast';
import { cn } from '@/lib/utils';
import { StatusType } from './status-badge';

interface StatusSelectProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => Promise<void>;
  className?: string;
}

const borderColors: Record<string, string> = {
  unreviewed: 'border-gray-300 focus:border-gray-500 focus:ring-gray-500',
  confirmed: 'border-red-300 focus:border-red-500 focus:ring-red-500',
  false_positive: 'border-green-300 focus:border-green-500 focus:ring-green-500',
  needs_review: 'border-amber-300 focus:border-amber-500 focus:ring-amber-500',
};

export function StatusSelect({ currentStatus, onStatusChange, className }: StatusSelectProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    setIsLoading(true);
    try {
      await onStatusChange(newStatus);
      showSuccess('Status updated');
    } catch (error) {
      showError('Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const borderClass = borderColors[currentStatus] || borderColors.unreviewed;

  return (
    <div className={cn("relative inline-block w-40", className)}>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isLoading}
        className={cn(
          "block w-full pl-3 pr-8 py-1.5 text-sm rounded-lg appearance-none bg-white border transition-colors",
          borderClass,
          isLoading && "opacity-70 cursor-wait"
        )}
      >
        <option value="unreviewed">Unreviewed</option>
        <option value="needs_review">Needs Review</option>
        <option value="false_positive">False Positive</option>
        <option value="confirmed">Confirmed Fraud</option>
      </select>
      {isLoading && (
        <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
}
