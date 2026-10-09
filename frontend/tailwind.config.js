/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Class-based dark mode — toggled by adding/removing `dark` on <html>,
  // driven by ThemeContext (src/context/ThemeContext.tsx) and persisted to localStorage.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Apple-style blue — #0071e3 is the classic apple.com CTA/link blue.
        brand: {
          50:  '#f5faff',
          100: '#e8f2ff',
          200: '#cce4ff',
          300: '#99c9ff',
          400: '#66adff',
          500: '#3392ff',
          600: '#1a84ff',
          700: '#147ce5',
          800: '#0071e3',
          900: '#005bb5',
          950: '#003d78',
        },
        accent: {
          400: '#f87171',
          // Button color is admin-configurable (Settings → Appearance). This CSS variable is
          // set at runtime by src/lib/appearance.ts; the hex after the comma is the fallback
          // used before that first fetch resolves (and matches AppearanceSetting's DB default).
          500: 'var(--rxl-button-bg, #dc2626)',
          600: '#b91c1c',
          700: '#991b1b',
        },
        dark: {
          700: '#1a1a1a',
          800: '#111111',
          900: '#0a0a0a',
          950: '#050505',
        },
        // Apple's neutral system grays (#f5f5f7 surface, #1d1d1f ink, #86868b secondary text,
        // #d2d2d7 dividers). Overriding the default Tailwind gray scale means every existing
        // bg-gray-50 / text-gray-900 / border-gray-200 utility across the app picks this up
        // automatically, without needing to touch each page.
        gray: {
          50:  '#fbfbfd',
          100: '#f5f5f7',
          200: '#e8e8ed',
          300: '#d2d2d7',
          400: '#aeaeb2',
          500: '#86868b',
          // Body/secondary text color — admin-configurable (Settings → Appearance).
          600: 'var(--rxl-text-body, #6e6e73)',
          700: '#515154',
          800: '#333336',
          // Heading/primary text color — admin-configurable (Settings → Appearance).
          900: 'var(--rxl-text-heading, #1d1d1f)',
          950: '#000000',
        },
      },
      fontFamily: {
        // On real Apple devices this resolves to San Francisco; Inter is the closest-shaped
        // web fallback for everyone else.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      boxShadow: {
        'apple-sm': '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)',
        'apple': '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        // Glow shadows for buttons / active menu highlights. `glow` follows the
        // admin-configurable button color; the others are fixed to match the
        // other recurring button hues used across the app (primary blue, sky
        // "add" buttons, orange table-row action icons).
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 18px -2px var(--rxl-button-bg, #dc2626), 0 0 4px -1px var(--rxl-button-bg, #dc2626)',
        'glow-blue': '0 0 0 1px rgba(255,255,255,0.08), 0 0 18px -2px rgba(0,113,227,0.65), 0 0 4px -1px rgba(0,113,227,0.65)',
        'glow-sky': '0 0 0 1px rgba(255,255,255,0.08), 0 0 18px -2px rgba(14,165,233,0.65), 0 0 4px -1px rgba(14,165,233,0.65)',
        'glow-orange': '0 0 14px -2px rgba(249,115,22,0.7)',
        'glow-white': '0 0 0 1px rgba(255,255,255,0.15), 0 0 16px -2px rgba(255,255,255,0.4)',
        // Urgent/attention-needed glow — used to draw a customer's eye to a shipment
        // that has an issue flagged (Issue Status set to anything other than "No issue").
        'glow-red': '0 0 0 1px rgba(255,255,255,0.1), 0 0 20px -1px rgba(220,38,38,0.85), 0 0 6px -1px rgba(220,38,38,0.85)',
      },
    },
  },
  plugins: [],
};
