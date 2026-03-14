/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF5722', // Vibrant orange
          dark: '#F4511E',
        },
        chalk: {
          DEFAULT: '#E3E3E3',
          dim: '#A0A0A0',
        },
        board: {
          DEFAULT: '#1A1A1A',
          light: '#2A2A2A',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
      },
    },
  },
  plugins: [],
};