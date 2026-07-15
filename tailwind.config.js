/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Mirrors Inventra's app/globals.css tokens (light / `-dark` pair per
        // token) so mobile screens stay visually consistent with the web app.
        bg: { DEFAULT: '#f8fafc', dark: '#0b0d12' },
        surface: { DEFAULT: '#ffffff', dark: '#14171f' },
        'surface-2': { DEFAULT: '#fbfcfe', dark: '#171b24' },
        text: { DEFAULT: '#111827', dark: '#eef1f7' },
        'text-2': { DEFAULT: '#55607a', dark: '#b3bacb' },
        muted: { DEFAULT: '#6b7280', dark: '#7f8aa0' },
        faint: { DEFAULT: '#aab2c4', dark: '#5c6579' },
        border: { DEFAULT: '#e5e7eb', dark: '#232834' },
        'border-2': { DEFAULT: '#eef1f6', dark: '#1d222c' },
        hover: { DEFAULT: '#f3f6fa', dark: '#1b1f29' },
        accent: { DEFAULT: '#2563eb', dark: '#3b82f6' },
        'accent-2': { DEFAULT: '#4f46e5', dark: '#6366f1' },
        'accent-weak': { DEFAULT: '#eff6ff', dark: '#17233f' },
        'accent-text': { DEFAULT: '#1d4ed8', dark: '#93c5fd' },
        green: { DEFAULT: '#10b981', dark: '#34d399' },
        'green-weak': { DEFAULT: '#ecfdf5', dark: '#0f2e26' },
        red: { DEFAULT: '#ef4444', dark: '#f87171' },
        'red-weak': { DEFAULT: '#fef2f2', dark: '#2e1618' },
        amber: { DEFAULT: '#f59e0b', dark: '#fbbf24' },
        'amber-weak': { DEFAULT: '#fffbeb', dark: '#2b2210' },
        sky: { DEFAULT: '#0891b2', dark: '#22d3ee' },
        'sky-weak': { DEFAULT: '#ecfeff', dark: '#0e2530' },
      },
    },
  },
  plugins: [],
};
