/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        flash: {
          '0%, 100%': { borderColor: '#ef4444', boxShadow: '0 0 10px #ef4444' },
          '50%':       { borderColor: '#7f1d1d', boxShadow: 'none' },
        },
      },
      animation: {
        flash: 'flash 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
