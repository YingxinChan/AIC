import colors from 'tailwindcss/colors'

// "Boarding pass" direction (see index.html's direction-contract comment):
// brand is the deep thermal-print navy that carries the surface — the
// dominant Committed color, not an accent. accent (amber) is deliberately
// NOT a general-purpose highlight color here — it's reserved for
// change/swap ("REBOOKED") states only; introducing it elsewhere dilutes
// the one signal it's meant to carry.
const brandNavy = {
  50: '#EEF1F7',
  100: '#DCE3F0',
  200: '#B9C7E0',
  300: '#8FA3CB',
  400: '#5D76A8',
  500: '#3A5080',
  600: '#2C4066',
  700: '#1F2E4D',
  800: '#16213A',
  900: '#0F1729',
  950: '#080D18',
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: brandNavy,
        accent: colors.amber,
        surface: '#F7F2E7',
        'surface-sunken': '#EFE6D2',
        ink: '#1A2233',
        'ink-muted': '#5B6478',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Every time/date/flight-number/ticket-data field — the thermal-
        // printer register of the boarding-pass direction, never used for
        // prose.
        mono: ['"Martian Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        h1: ['clamp(1.875rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        h2: ['clamp(1.5rem, 2.2vw, 2rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h3: ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.65' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55' }],
        label: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.08em' }],
      },
      boxShadow: {
        'bento-sm': '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.05)',
        bento: '0 1px 2px rgba(16,24,40,.04), 0 6px 16px -4px rgba(16,24,40,.08)',
        'bento-hover': '0 2px 4px rgba(16,24,40,.04), 0 16px 32px -8px rgba(16,24,40,.12)',
        'bento-lg': '0 4px 8px rgba(16,24,40,.04), 0 32px 64px -12px rgba(16,24,40,.16)',
        'brand-glow': '0 8px 24px -6px rgba(15,23,41,.45)',
        // A paper object lifted well off the surface — firmer and more
        // vertically offset than the ambient "bento" shadows, so ticket
        // artifacts read as a physical thing sitting on the page rather
        // than a flat card with a rounded corner.
        ticket: '0 2px 4px rgba(15,23,41,.14), 0 28px 56px -14px rgba(15,23,41,.45)',
        // The small rotated amber "REBOOKED" stamp — a tight, warm-tinted
        // shadow, not a glow.
        stamp: '0 2px 6px -1px rgba(180,120,10,.4)',
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(at 0% 0%, #16213A 0px, transparent 55%), radial-gradient(at 90% 10%, #2C4066 0px, transparent 50%), radial-gradient(at 50% 100%, #0F1729 0px, transparent 60%)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up .3s ease-out both',
      },
    },
  },
  plugins: [],
}
