/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Fontes Customizadas
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // Adicionando uma animação suave para a aurora se mover levemente
      animation: {
        'aurora-slow': 'aurora 15s ease infinite alternate',
        'aurora-delayed': 'aurora 20s ease infinite alternate-reverse',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 4s ease-in-out infinite',
        'chord-pulse': 'chordPulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        aurora: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(40px, -60px) scale(1.2)' },
          '100%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(0.85)' },
        },
        chordPulse: {
          '0%': { transform: 'scale(0.85)', opacity: '0.3', filter: 'brightness(2)' },
          '50%': { transform: 'scale(1.05)', opacity: '1', filter: 'brightness(1.5)' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'brightness(1)' },
        },
      }
    },
  },
  plugins: [],
}