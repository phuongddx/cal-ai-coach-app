/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ED-Safe seed tokens (Phase 1): calm neutrals only.
        // No moral-coded red/green; judgment-free surfaces; full dark-mode pair.
        surface: {
          light: '#F7F7F5',
          dark: '#141416',
        },
        ink: {
          light: '#1C1C1E',
          dark: '#EDEDED',
        },
        accent: {
          lime: '#C8F169',
        },
        muted: {
          light: '#8E8E93',
          dark: '#6C6C70',
        },
      },
    },
  },
  plugins: [],
};
