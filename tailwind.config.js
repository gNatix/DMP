/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dm-dark': '#1e1f23',
        'dm-panel': '#2a2b30',
        'dm-border': '#3a3b40',
        'dm-highlight': '#22c55e',
      },
    },
  },
  plugins: [],
}
