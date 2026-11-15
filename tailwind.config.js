/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #9885E8)',
          hover: 'var(--color-primary-hover, #8772E2)',
          light: 'var(--color-primary-light, #C7B9F5)',
          subtle: 'var(--color-primary-subtle, #EDE8FC)',
        },
        lavender: {
          50: '#F5F1FF',
          100: '#EDE8FC',
          200: '#DDD4F9',
          300: '#C7B9F5',
          400: '#B09EF1',
          500: '#9885E8',
          600: '#816BE0',
          700: '#6850C8',
          800: '#55458A',
          900: '#3B2E6A',
        },
        surface: 'var(--color-surface, #FFFFFF)',
        'surface-hover': 'var(--color-surface-hover, #FAF8FF)',
        sidebar: 'var(--color-sidebar, #F8F5FE)',
        'dream-bg': 'var(--color-bg, #F5F1FF)',
        'deep-purple': 'var(--color-text-main, #55458A)',
        'muted-purple': 'var(--color-text-muted, #A99CCB)',
        'soft-pink': 'var(--color-accent-pink, #F7DDED)',
        'soft-pink-text': 'var(--color-accent-pink-text, #9B4D7D)',
        'mint-accent': 'var(--color-accent-mint, #DDF3E9)',
        'mint-accent-text': 'var(--color-accent-mint-text, #2D7C5D)',
        'soft-peach': 'var(--color-accent-peach, #FEF3D6)',
        'soft-peach-text': 'var(--color-accent-peach-text, #A86B12)',
        'soft-blue': 'var(--color-accent-blue, #E8F1FF)',
        'soft-blue-text': 'var(--color-accent-blue-text, #376EC4)',
        border: 'var(--border-subtle, #E8E0FA)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        decorative: ['Quicksand', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '26px',
        '4xl': '32px',
      },
      boxShadow: {
        'lavender-sm': '0 4px 14px rgba(152, 133, 232, 0.08)',
        'lavender': '0 10px 28px rgba(152, 133, 232, 0.12)',
        'lavender-lg': '0 16px 36px rgba(152, 133, 232, 0.18)',
        'lavender-inner': 'inset 0 2px 4px 0 rgba(152, 133, 232, 0.06)',
      },
      animation: {
        'bounce-subtle': 'bounceSubtle 2.5s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(1.5deg)' },
        },
      },
    },
  },
  plugins: [],
};
