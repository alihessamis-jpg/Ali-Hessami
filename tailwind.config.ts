import type { Config } from 'tailwindcss'

// Scoped on purpose: this app's existing pages are hand-written CSS
// (src/index.css), not Tailwind. This config only scans the one page that
// actually uses Tailwind utility classes, and disables Preflight (Tailwind's
// global element reset) so adding Tailwind for that one page can't change
// how buttons, headings, etc. look anywhere else in the app.
export default {
  content: ['./src/pages/StudioCtaPage.tsx', './src/components/StudioCtaFooter.tsx'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Instrument Serif'", 'serif'],
        body: ["'Barlow'", 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
