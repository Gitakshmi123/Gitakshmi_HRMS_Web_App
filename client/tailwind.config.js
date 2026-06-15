/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'premium-blue': '#4A8FE7',
        'premium-blue-dark': '#3A7BC8',
        'mint-aqua': '#77D4C8',
        'soft-yellow': '#FFC857',
        'soft-bg': '#F5F8FB',
        'deep-navy': '#2C3E50',
        'card-white': '#FFFFFF',
        'success-green': '#3CCB7F',
        'warning-red': '#E86A6A',
        'icon-bg': '#EEF2F8',
      },
    },
  },
  plugins: [],
};
