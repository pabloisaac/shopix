import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Paleta Shopix ── teal + índigo del logo ──────
        brand: {
          teal:    '#00C896',
          'teal-dim': '#00A87E',
          'teal-light': '#E6FBF5',
          indigo:  '#6366F1',
          'indigo-dim': '#4F46E5',
          'indigo-light': '#EEF2FF',
        },
        // Alias "accent" → teal (acción principal)
        accent: {
          DEFAULT: '#00C896',
          dim:     '#00A87E',
          light:   '#E6FBF5',
        },
        // Alias "secondary" → índigo
        secondary: {
          DEFAULT: '#6366F1',
          dim:     '#4F46E5',
          light:   '#EEF2FF',
        },
        // Fondos
        bg: {
          primary:  '#F7F8FA',
          secondary:'#FFFFFF',
          elevated: '#FFFFFF',
          border:   '#E5E7EB',
        },
        border: '#E5E7EB',
        // Textos
        text: {
          primary:   '#0F172A',
          secondary: '#334155',
          muted:     '#64748B',
          faint:     '#94A3B8',
        },
        // Compatibilidad con clases antiguas
        shopix: {
          text:  '#0F172A',
          muted: '#64748B',
          faint: '#94A3B8',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        // Gradiente firma: teal → índigo (igual que el logo)
        'brand-gradient':  'linear-gradient(135deg, #00C896 0%, #6366F1 100%)',
        'brand-gradient-r':'linear-gradient(135deg, #6366F1 0%, #00C896 100%)',
        // Hero background muy sutil
        'hero-gradient':   'linear-gradient(135deg, #E6FBF5 0%, #EEF2FF 55%, #F7F8FA 100%)',
        // Card interna
        'gradient-card':   'linear-gradient(180deg, #FFFFFF 0%, #F7F8FA 100%)',
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 8px 24px -4px rgb(99 102 241 / 0.12), 0 2px 6px -1px rgb(0 200 150 / 0.08)',
        'brand':      '0 4px 16px -2px rgb(0 200 150 / 0.30)',
        'indigo':     '0 4px 16px -2px rgb(99 102 241 / 0.30)',
        'modal':      '0 20px 60px -10px rgb(0 0 0 / 0.15)',
      },
      animation: {
        'fade-in':  'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'pulse-slow':'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity:'0', transform:'translateY(12px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

export default config
