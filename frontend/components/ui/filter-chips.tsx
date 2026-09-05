'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type FilterOption = string | { label: string; value: string };

export interface FilterChipsProps {
  options: FilterOption[];
  selected?: string[];
  value?: string;
  onChange: (value: any) => void;
  className?: string;
}

export function FilterChips({ options, selected, value, onChange, className }: FilterChipsProps) {
  const isSingle = value !== undefined;

  const normalizedOptions = options.map((opt) => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const handleClick = (optValue: string) => {
    if (isSingle) {
      onChange(optValue);
    } else {
      const current = selected || [];
      if (current.includes(optValue)) {
        onChange(current.filter(s => s !== optValue));
      } else {
        onChange([...current, optValue]);
      }
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {normalizedOptions.map((option) => {
        const isSelected = isSingle 
          ? value === option.value 
          : (selected || []).includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            className={cn(
              'relative flex items-center h-8 px-3 text-sm font-medium rounded-full transition-colors border cursor-pointer',
              isSelected 
                ? 'bg-blue-100 border-blue-600 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
            )}
          >
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ width: 0, opacity: 0, marginRight: 0 }}
                  animate={{ width: 'auto', opacity: 1, marginRight: 6 }}
                  exit={{ width: 0, opacity: 0, marginRight: 0 }}
                  className="overflow-hidden"
                >
                  <Check className="w-4 h-4 text-blue-600" />
                </motion.div>
              )}
            </AnimatePresence>
            {option.label}
          </button>
        );
      })}
      {!isSingle && selected && selected.length > 0 && (
        <button 
          type="button"
          onClick={() => onChange([])} 
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium ml-2 cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
