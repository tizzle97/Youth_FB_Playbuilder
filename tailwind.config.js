import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Default Tailwind screens jump straight from 0 to `sm: 640px`, so a
      // 320px phone and a 639px foldable get identical mobile treatment.
      // `xs` gives layouts a checkpoint inside that range without touching
      // the existing sm/md/lg/xl/2xl breakpoints (this extends, not replaces).
      screens: {
        xs: '400px',
      },
      colors: {
        primary: {
          DEFAULT: '#1FA75D', // Turf green (brand accent)
          dark: '#178B4D',
        },
        chalk: {
          DEFAULT: '#F8F6F1', // Warm chalk cream (brand)
          dim: '#8FA0B5',
        },
        board: {
          DEFAULT: '#101D2E', // Deep navy (brand)
          light: '#16283D',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
        display: ['Anton', 'sans-serif'],
        label: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [typography],
};