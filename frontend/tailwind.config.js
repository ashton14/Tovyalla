/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pool: {
          blue: '#0EA5E9',
          dark: '#0284C7',
          light: '#E0F2FE',
        },
      },
      animation: {
        'dropdown-in': 'dropdown-in 0.15s ease-out forwards',
        'aurora-pulse-1': 'aurora-pulse-1 4s ease-in-out infinite',
        'aurora-pulse-2': 'aurora-pulse-2 3s ease-in-out infinite',
        'aurora-pulse-3': 'aurora-pulse-3 5s ease-in-out infinite',
        'aurora-pulse-4': 'aurora-pulse-4 3.5s ease-in-out infinite',
        'aurora-drift': 'aurora-drift 8s ease-in-out infinite',
      },
      keyframes: {
        'dropdown-in': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'aurora-pulse-1': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1) translate(0%, 0%)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15) translate(5%, -3%)' },
        },
        'aurora-pulse-2': {
          '0%, 100%': { opacity: '0.25', transform: 'scale(1.1) translate(-3%, 2%)' },
          '50%': { opacity: '0.6', transform: 'scale(0.95) translate(3%, -5%)' },
        },
        'aurora-pulse-3': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.95) translate(2%, 3%)' },
          '50%': { opacity: '0.65', transform: 'scale(1.2) translate(-4%, -2%)' },
        },
        'aurora-pulse-4': {
          '0%, 100%': { opacity: '0.2', transform: 'scale(1) translate(0%, 5%)' },
          '50%': { opacity: '0.55', transform: 'scale(1.25) translate(0%, -8%)' },
        },
        'aurora-drift': {
          '0%': { transform: 'translate(0%, 0%) rotate(0deg)' },
          '25%': { transform: 'translate(8%, -6%) rotate(3deg)' },
          '50%': { transform: 'translate(-4%, 8%) rotate(-2deg)' },
          '75%': { transform: 'translate(-8%, -4%) rotate(2deg)' },
          '100%': { transform: 'translate(0%, 0%) rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}

