import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f5fb',
          100: '#e7eaf7',
          200: '#cfd6ef',
          300: '#aab7e3',
          400: '#7d91d4',
          500: '#5b7fd0',
          600: '#455fb4',
          700: '#35488b',
          800: '#222748',
          900: '#15151e',
        },
        gold: {
          50: '#fff8eb',
          100: '#feefc8',
          200: '#fce094',
          300: '#f7c95d',
          400: '#efb33d',
          500: '#dd9e33',
          600: '#b97b22',
          700: '#935b1c',
          800: '#6f431a',
          900: '#533316',
        },
        ink: {
          50: '#f8f8fb',
          100: '#efeff4',
          200: '#e3e4ec',
          300: '#c9cbda',
          400: '#8f93a9',
          500: '#666a7d',
          600: '#4b4e60',
          700: '#363847',
          800: '#222431',
          900: '#12131c',
        },
      },
      boxShadow: {
        card: '0 18px 44px -32px rgba(15, 23, 42, 0.34)',
        panel: '0 30px 60px -38px rgba(13, 16, 30, 0.55)',
      },
      fontFamily: {
        sans: ['Avenir Next', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Gill Sans', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
