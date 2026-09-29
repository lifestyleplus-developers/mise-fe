/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}', './shared/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',

        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
          soft: 'var(--destructive-soft)',
          'soft-foreground': 'var(--destructive-soft-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
          soft: 'var(--success-soft)',
          'soft-foreground': 'var(--success-soft-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
          soft: 'var(--warning-soft)',
          'soft-foreground': 'var(--warning-soft-foreground)',
        },
        pending: {
          DEFAULT: 'var(--pending)',
          foreground: 'var(--pending-foreground)',
          soft: 'var(--pending-soft)',
          'soft-foreground': 'var(--pending-soft-foreground)',
        },

        border: 'var(--border)',
        input: 'var(--input)',
        'input-edge': 'var(--input-edge)',
        ring: 'var(--ring)',

        nav: {
          surface: 'var(--nav-surface)',
          border: 'var(--nav-border)',
          foreground: 'var(--nav-foreground)',
          segment: 'var(--nav-segment)',
          active: 'var(--nav-active)',
        },

        scrim: 'var(--scrim)',
      },
    },
  },
  plugins: [],
};
