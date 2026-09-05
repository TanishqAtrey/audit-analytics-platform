'use client';
import React, { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadButtonProps {
  children: ReactNode;
  onClick: () => Promise<void>;
  className?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

export function LoadButton({ children, onClick, className, variant = 'primary', disabled, loading }: LoadButtonProps) {
  const [internalState, setInternalState] = useState<'idle' | 'loading' | 'done'>('idle');

  const isLoading = loading !== undefined ? loading : internalState === 'loading';
  const isDone = internalState === 'done';

  const handleClick = async () => {
    if (isLoading || isDone || disabled) return;
    setInternalState('loading');
    try {
      await onClick();
      setInternalState('done');
      setTimeout(() => setInternalState('idle'), 2000);
    } catch (error) {
      setInternalState('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading || isDone}
      className={cn(
        'relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors overflow-hidden cursor-pointer',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-500',
        variant === 'secondary' && 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
        (disabled || isLoading || isDone) && 'opacity-70 cursor-not-allowed',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {!isLoading && !isDone && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-2"
          >
            {children}
          </motion.span>
        )}
        {isLoading && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="flex items-center"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </motion.span>
        )}
        {isDone && (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={cn(
              "flex items-center justify-center w-full h-full",
              variant === 'primary' ? "text-green-400" : "text-green-500"
            )}
          >
            <Check className="w-5 h-5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
