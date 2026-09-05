'use client';
import { Toaster, toast } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster 
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-white border border-gray-200 shadow-lg text-gray-900',
          title: 'text-sm font-semibold',
          description: 'text-sm text-gray-500',
          success: 'border-l-4 border-l-blue-600',
          error: 'border-l-4 border-l-red-500',
          info: 'border-l-4 border-l-gray-400',
        },
      }}
    />
  );
}

export const showSuccess = (message: string, description?: string) => {
  toast.success(message, { description });
};

export const showError = (message: string, description?: string) => {
  toast.error(message, { description });
};

export const showInfo = (message: string, description?: string) => {
  toast.info(message, { description });
};
