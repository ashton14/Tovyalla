/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        pool: {
          blue: '#0EA5E9',
          dark: '#0284C7',
          light: '#E0F2FE',
        },
      },
    },
  },
  plugins: [],
}

