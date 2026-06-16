import type { Config } from 'tailwindcss';

/**
 * tailwind.config.ts — SGPI Design System
 * Basado en "Institutional Research OS" (design.md)
 * Fuentes: IBM Plex Sans (headings) · Inter (body/UI) · JetBrains Mono (código)
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/SGPI-CFU/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Paleta SGPI ──────────────────────────────────────────────────────────
      colors: {
        surface:                    '#f9f9ff',
        'surface-dim':              '#cfdaf2',
        'surface-bright':           '#f9f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f0f3ff',
        'surface-container':        '#e7eeff',
        'surface-container-high':   '#dee8ff',
        'surface-container-highest':'#d8e3fb',
        'on-surface':               '#111c2d',
        'on-surface-variant':       '#43474f',
        'inverse-surface':          '#263143',
        'inverse-on-surface':       '#ecf1ff',
        outline:                    '#73777f',
        'outline-variant':          '#c3c6d0',
        'surface-tint':             '#40608b',
        primary:                    '#001631',
        'on-primary':               '#ffffff',
        'primary-container':        '#002b54',
        'on-primary-container':     '#7493c2',
        'inverse-primary':          '#a8c8fa',
        secondary:                  '#505f76',
        'on-secondary':             '#ffffff',
        'secondary-container':      '#d0e1fb',
        'on-secondary-container':   '#54647a',
        tertiary:                   '#131718',
        'on-tertiary':              '#ffffff',
        'tertiary-container':       '#282b2d',
        'on-tertiary-container':    '#8f9294',
        error:                      '#ba1a1a',
        'on-error':                 '#ffffff',
        'error-container':          '#ffdad6',
        'on-error-container':       '#93000a',
        'primary-fixed':            '#d4e3ff',
        'primary-fixed-dim':        '#a8c8fa',
        'on-primary-fixed':         '#001c3a',
        'on-primary-fixed-variant': '#264872',
        'secondary-fixed':          '#d3e4fe',
        'secondary-fixed-dim':      '#b7c8e1',
        'on-secondary-fixed':       '#0b1c30',
        'on-secondary-fixed-variant':'#38485d',
        'tertiary-fixed':           '#e0e3e5',
        'tertiary-fixed-dim':       '#c4c7c9',
        'on-tertiary-fixed':        '#191c1e',
        'on-tertiary-fixed-variant':'#444749',
        background:                 '#f9f9ff',
        'on-background':            '#111c2d',
        'surface-variant':          '#d8e3fb',

        // Semáforo (Traffic Light System)
        success: {
          DEFAULT: '#059669',
          light:   '#d1fae5',
          dark:    '#047857',
        },
        warning: {
          DEFAULT: '#d97706',
          light:   '#fef3c7',
          dark:    '#b45309',
        },
      },

      // ── Tipografía ───────────────────────────────────────────────────────────
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'h1':         ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'h2':         ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3':         ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-md':    ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm':    ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }],
        'code':       ['13px', { lineHeight: '20px', fontWeight: '400' }],
      },

      // ── Bordes ───────────────────────────────────────────────────────────────
      borderRadius: {
        sm:      '0.125rem',   // 2px
        DEFAULT: '0.25rem',    // 4px — Soft language
        md:      '0.375rem',   // 6px
        lg:      '0.5rem',     // 8px
        xl:      '0.75rem',    // 12px
        full:    '9999px',     // Pill — Status badges
      },

      // ── Sombras (Tonal Layering > Shadow) ────────────────────────────────────
      boxShadow: {
        none:     'none',
        'level-1':'0 0 0 1px rgb(195 198 208)',            // Level 1: 1px outline-variant border
        'level-2':'0 2px 8px rgba(0, 0, 0, 0.04), 0 0 0 1px rgb(195 198 208)', // Level 2: diffused
      },

      // ── Spacing extras ───────────────────────────────────────────────────────
      spacing: {
        'container': '24px',
        'gutter':    '16px',
        'gap':       '8px',
      },

      // ── Sidebar width ────────────────────────────────────────────────────────
      width: {
        sidebar: '220px',
      },
    },
  },
  plugins: [],
};

export default config;
