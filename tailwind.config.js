/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './shared/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Each weight is a separate family: RN resolves a font by family name
      // and cannot select a weight within one, so `font-semibold` alone would
      // synthesise a fake bold off the regular file.
      fontFamily: {
        sans: ['Montserrat_400Regular'],
        'sans-medium': ['Montserrat_500Medium'],
        'sans-semibold': ['Montserrat_600SemiBold'],
        'sans-bold': ['Montserrat_700Bold'],
        display: ['PlayfairDisplay_600SemiBold'],
        // Interface scripts for the four-language requirement (FE Spec §9).
        // RN resolves a single fontFamily name — no CSS-style fallback stack
        // — so Latin text in these classes keeps Montserrat's fallback and
        // Devanagari/Malayalam/Kannada glyphs fall through to these faces.
        // Loaded in _layout.tsx before the first frame.
        'sans-devanagari': ['NotoSansDevanagari_400Regular'],
        'sans-malayalam': ['NotoSansMalayalam_400Regular'],
        'sans-kannada': ['NotoSansKannada_400Regular'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
          'soft-foreground': 'hsl(var(--destructive-soft-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
          'soft-foreground': 'hsl(var(--success-soft-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
          'soft-foreground': 'hsl(var(--warning-soft-foreground))',
        },
        pending: {
          DEFAULT: 'hsl(var(--pending))',
          foreground: 'hsl(var(--pending-foreground))',
          soft: 'hsl(var(--pending-soft))',
          'soft-foreground': 'hsl(var(--pending-soft-foreground))',
        },

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        'input-edge': 'hsl(var(--input-edge))',
        ring: 'hsl(var(--ring))',

        nav: {
          surface: 'var(--nav-surface)',
          border: 'hsl(var(--nav-border))',
          foreground: 'hsl(var(--nav-foreground))',
          segment: 'hsl(var(--nav-segment))',
          active: 'hsl(var(--nav-active))',
        },

        scrim: 'var(--scrim)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
