/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#F5F3EF',
          secondary: '#ECE8E1',
          tertiary: '#E4DFD6',
        },
        'paper-hi': '#FAF8F4',

        text: {
          primary: '#1C1C1C',
          secondary: '#6B6B6B',
          tertiary: '#9A9A9A',
          disabled: '#BDBDBD',
          warm: '#2A2520',
        },

        accent: {
          DEFAULT: '#8E6F5E',
          deep: '#5C4538',
        },
        sage: '#7A8471',
        like: '#C86C6C',

        border: {
          DEFAULT: '#D8D3CB',
          divider: '#DDD7CF',
        },
        rule: '#C9C2B5',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        display: ['InstrumentSerif_400Regular'],
        'display-italic': ['InstrumentSerif_400Regular_Italic'],
      },
      borderRadius: {
        card: '12px',
        'card-lg': '14px',
        button: '8px',
        pill: '99px',
        input: '10px',
        cover: '10px',
        'cover-sm': '8px',
        badge: '6px',
        'badge-sm': '5px',
      },
    },
  },
  plugins: [],
};
