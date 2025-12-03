import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ing: {
          orange: '#FF6200',
          lightOrange: '#FF8243',
          darkOrange: '#E65A00',
          dark: '#1F1F1F',
          text: '#333333',
          accent: '#E5E5E5',
          white: '#FFFFFF',
          lightGray: '#F5F5F5',
          darkGray: '#333333',
          warmGray: '#F7F7F7',
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
        handwritten: ['Caveat', 'cursive'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out infinite 2s',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-20px) translateX(10px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
