/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'trading-bg': '#1E222D',
        'trading-panel': '#2B2B43',
        'trading-border': '#3F3F5F',
        'trading-text': '#DDD',
        'trading-up': '#26a69a',
        'trading-down': '#ef5350',
      },
    },
  },
  plugins: [],
} 