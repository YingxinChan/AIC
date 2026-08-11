import colors from 'tailwindcss/colors'

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.indigo,
        accent: colors.amber,
        surface: '#F5F5F7',
        'surface-sunken': '#EDEDF0',
        ink: '#1D1D1F',
        'ink-muted': '#6E6E73',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
        'brand-glow': '0 8px 24px -6px rgba(79,70,229,.45)',
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(at 0% 0%, #4f46e5 0px, transparent 55%), radial-gradient(at 90% 10%, #7c3aed 0px, transparent 50%), radial-gradient(at 50% 100%, #4338ca 0px, transparent 60%)',
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
