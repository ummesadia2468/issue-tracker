const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { bg: c('bg'), surface: c('surface'), ink: c('ink'), muted: c('muted'), line: c('line'), accent: c('accent'), 'accent-ink': c('accent-ink'), danger: c('danger') },
      // Public Sans has no Arabic glyphs, so Urdu text falls through to Noto Naskh Arabic automatically
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Noto Naskh Arabic"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', '"Noto Naskh Arabic"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { md: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.96)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--danger) / .5)' }, '100%': { boxShadow: '0 0 0 10px rgb(var(--danger) / 0)' } },
      },
      animation: { rise: 'rise .35s ease-out both', pop: 'pop .15s ease-out both', ring: 'pulseRing 1.2s ease-out 2' },
    },
  },
  plugins: [],
};
