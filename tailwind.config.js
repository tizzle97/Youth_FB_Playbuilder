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
        // Stadium floodlight amber — ambient/mood color only (glows,
        // gradients, dividers). Never used on interactive elements; primary
        // green stays the only clickable color so the two accents don't
        // compete for the same job.
        stadium: '#E8A33D',
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
        display: ['Anton', 'sans-serif'],
        label: ['"JetBrains Mono"', 'monospace'],
        // Marketing-copy body face for the homepage only — everywhere else
        // (designer, dashboards, forms) stays on `font-sans` (Inter var).
        editorial: ['Fraunces', 'Georgia', 'serif'],
      },
      aspectRatio: {
        // Matches EXPORT_WIDTH/EXPORT_HEIGHT (1650x1275) in
        // renderPlayScene.ts — reduces to 22/17. Every stored play thumbnail
        // is rendered at this ratio; a mismatched container pillarboxes the
        // diagram and the gap reads as an unstyled white margin. Keep this in
        // sync if the export size ever changes.
        play: '22 / 17',
      },
    },
  },
  plugins: [typography],
};