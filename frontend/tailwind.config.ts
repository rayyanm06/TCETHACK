import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '375px',
      sm: '430px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        paper: '#F5F2EA',
        surface: '#FFFFFF',
        'surface-2': '#EFEBE0',
        ink: '#17231C',
        'ink-2': '#3F4F45',
        'ink-3': '#5F6D64',
        line: '#D9D4C7',
        moss: {
          DEFAULT: '#2E6B4E',
          700: '#1F4F3A',
          100: '#DCE9DF',
        },
        lagoon: {
          DEFAULT: '#0E6A78',
          100: '#D4ECEF',
        },
        clay: {
          DEFAULT: '#C4492F',
          100: '#F6DDD5',
        },
        ochre: {
          DEFAULT: '#C48A12',
          100: '#F6E8C6',
        },
        plum: {
          DEFAULT: '#6B4F8F',
          100: '#E9E1F2',
        },
      },
      fontFamily: {
        serif: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(23, 35, 28, 0.06)',
        panel: '0 8px 24px rgba(23, 35, 28, 0.10)',
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '8px',
        panel: '16px',
        pill: '999px',
      },
    },
  },
  plugins: [],
} satisfies Config;
