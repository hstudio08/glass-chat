/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatly: {
          dark: '#4a3a3a',      // Primary text
          maroon: '#a76f6f',    // Buttons & Icons
          rose: '#c67b7b',      // Gradients
          peach: '#fdf2f0',     // Background highlights
          green: '#5ba574',     // Online badge
        }
      }
    },
  },
  plugins: [],
}