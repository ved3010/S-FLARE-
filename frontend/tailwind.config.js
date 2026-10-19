/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sf: {
          bg: '#000000',
          surface: '#0A0A0A',
          elevated: '#121212',
          border: 'rgba(255, 255, 255, 0.15)',
          'border-focus': '#FFFFFF',
          text: '#FFFFFF',
          'text-secondary': '#D1D5DB',
          'text-muted': '#9CA3AF',
          quiet: '#2ECC71',
          watch: '#F1C40F',
          warning: '#E74C3C',
          active: '#E74C3C',
          recovery: '#3498DB',
          'soft-xray': '#E67E22',
          'hard-xray': '#3498DB',
          hardness: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
