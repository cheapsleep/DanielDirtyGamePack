/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'campfire': ['Thertole', 'Campfire', 'sans-serif'],
        'thertole': ['Thertole', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
