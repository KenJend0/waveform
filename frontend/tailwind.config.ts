import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System Waveform — Charte Graphique Officielle
        background: {
          DEFAULT: '#F5F3EF',      // Fond principal
          secondary: '#ECE8E1',    // Surface secondaire
          tertiary: '#E4DFD6',     // Surface tertiaire
        },
        border: {
          DEFAULT: '#D8D3CB',      // Border neutre
          divider: '#DDD7CF',      // Divider léger
        },
        accent: {
          DEFAULT: '#8E6F5E',      // Brun chaud — usage très limité
          hover: '#A17F6D',        // Brun chaud hover
          muted: 'rgba(142,111,94,0.08)', // Accent très léger
        },
        like: '#C86C6C',           // Like actif (désaturé)
        text: {
          primary: '#1C1C1C',      // Texte principal (presque noir)
          secondary: '#6B6B6B',    // Texte secondaire
          tertiary: '#9A9A9A',     // Texte tertiaire
          disabled: '#BDBDBD',     // Texte désactivé
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
      },
      fontSize: {
        'h1': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'h2': ['22px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
        'h3': ['24px', { lineHeight: '1.3', fontWeight: '500' }],
        'body': ['16px', { lineHeight: '1.75', fontWeight: '400' }],
        'meta': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['12px', { lineHeight: '1.5', letterSpacing: '0.08em', fontWeight: '500' }],
      },
      lineHeight: {
        tight: '1.2',
        snug: '1.4',
        relaxed: '1.75',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'input': '10px',
        'cover': '10px',
        'cover-sm': '8px',
      },
      spacing: {
        'section-lg': '48px',
        'section-md': '32px',
        'section-sm': '16px',
        'micro': '8px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      maxWidth: {
        'page': '672px',
      },
    },
  },
  plugins: [],
};

export default config;
