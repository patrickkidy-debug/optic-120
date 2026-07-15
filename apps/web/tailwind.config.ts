import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Couleurs unies : `rgb(var(--x-rgb) / <alpha-value>)` — c'est ce qui rend
      // les modificateurs d'opacité (bg-primary/10, bg-surface-2/50…) réellement
      // fonctionnels. Écrites `var(--x)`, Tailwind abandonnait la classe en
      // silence. Les tokens qui portent déjà leur transparence (line, *-soft)
      // gardent var() et s'emploient sans modificateur.
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        'bg-subtle': 'rgb(var(--bg-subtle-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3-rgb) / <alpha-value>)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover-rgb) / <alpha-value>)',
          soft: 'var(--primary-soft)',
        },
        cyan: {
          DEFAULT: 'rgb(var(--accent-cyan-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          soft: 'var(--accent-soft)',
        },
        content: {
          DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          faint: 'rgb(var(--text-faint-rgb) / <alpha-value>)',
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.65rem',
        xl: '0.9rem',
        '2xl': '1.15rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(2,6,23,0.18), 0 4px 14px rgba(2,6,23,0.12)',
        'card-lg': '0 8px 30px rgba(2,6,23,0.22)',
        glow: '0 0 0 1px var(--primary-soft), 0 8px 24px rgba(37,99,235,0.18)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
