import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return `${(score * 100).toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'unreviewed':
      return 'text-gray-500 bg-gray-100 border-gray-200';
    case 'confirmed':
      return 'text-red-700 bg-red-100 border-red-200';
    case 'false_positive':
      return 'text-green-700 bg-green-100 border-green-200';
    case 'needs_review':
      return 'text-amber-700 bg-amber-100 border-amber-200';
    default:
      return 'text-gray-500 bg-gray-100 border-gray-200';
  }
}

export function statusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'unreviewed':
      return 'Unreviewed';
    case 'confirmed':
      return 'Confirmed';
    case 'false_positive':
      return 'False Positive';
    case 'needs_review':
      return 'Needs Review';
    default:
      return status;
  }
}
