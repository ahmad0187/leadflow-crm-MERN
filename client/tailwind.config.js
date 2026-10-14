/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#f4f1ff', 100: '#e9e3ff', 200: '#d4c9ff', 500: '#7c5cff', 600: '#6a45f5', 700: '#5a34dc', 900: '#2b1a6e' },
        ink: { 900: '#141322', 800: '#1d1b2f', 700: '#2a2840', 500: '#5d5b73', 400: '#8a889e', 200: '#dddbe7', 100: '#eceaf3', 50: '#f6f5fa' },
      },
      boxShadow: { card: '0 1px 2px rgba(20,19,34,.04), 0 4px 16px rgba(20,19,34,.05)' },
    },
  },
  plugins: [],
};
