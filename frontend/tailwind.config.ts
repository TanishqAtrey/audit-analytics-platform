import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          hover: '#3b82f6',
        },
        sidebar: '#f8fafc',
        card: {
          DEFAULT: '#ffffff',
          border: '#e5e7eb',
        },
        status: {
          unreviewed: '#9ca3af',
          confirmed: '#ef4444',
          false_positive: '#22c55e',
          needs_review: '#f59e0b',
        }
      },
    },
  },
  plugins: [],
}
export default config
