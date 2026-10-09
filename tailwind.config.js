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
    // shadow-<colour> is only ever black with an alpha here. Left at its
    // default (the whole palette) a colour named `card` also claims
    // `shadow-card`, and wins, colouring the shadow with the card's own
    // background instead of applying the shadow below.
    boxShadowColor: {
      transparent: 'transparent',
      black: '#000',
      white: '#fff',
    },
    extend: {
      // One family per weight; RN cannot select a weight within a family.
      fontFamily: {
        sans: ['Montserrat_400Regular'],
        'sans-medium': ['Montserrat_500Medium'],
        'sans-semibold': ['Montserrat_600SemiBold'],
        'sans-bold': ['Montserrat_700Bold'],
        display: ['PlayfairDisplay_600SemiBold'],
        script: ['BrittanySignature'],
        // Devanagari, Malayalam and Kannada faces (FE Spec §9).
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
      // The mockup's card shadow is two CSS layers. React Native keeps only
      // the first and forces full opacity, so the layers are merged into one
      // and the alpha lives in --shadow-card, which dark mode strengthens.
      boxShadow: {
        card: '0px 4px 12px var(--shadow-card)',
      },
      // Android ignores shadow colour and radius and draws from elevation;
      // without this it would derive 12 from the blur, which is far too heavy.
      elevation: {
        card: 2,
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
