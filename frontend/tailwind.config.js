/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce9ff',
          200: '#b8d2ff',
          300: '#8ab3ff',
          400: '#5c8fff',
          500: '#2f65f0',
          600: '#1f4fd6',
          700: '#173dac',
          800: '#122f85',
          900: '#0d2263',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(13, 34, 99, 0.06), 0 1px 3px 0 rgba(13, 34, 99, 0.08)',
      },
    },
  },
  plugins: [],
};
