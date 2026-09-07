import type { Config } from 'tailwindcss';

/**
 * Brand tokens are lifted verbatim from the agastyaone-quote and
 * agastyaone-invoice generators, so the platform, the quotes you send and the
 * invoices you bill with read as one brand rather than three.
 *
 * Colours resolve through CSS variables (see app/globals.css) so light and dark
 * are one token set, not two hardcoded palettes.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          deep:    'rgb(var(--brand-deep) / <alpha-value>)',
          wash:    'rgb(var(--brand-wash) / <alpha-value>)',
          line:    'rgb(var(--brand-line) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          deep:    'rgb(var(--accent-deep) / <alpha-value>)',
        },
        ink:     'rgb(var(--ink) / <alpha-value>)',
        muted:   'rgb(var(--muted) / <alpha-value>)',
        danger:  'rgb(var(--danger) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        canvas:  'rgb(var(--canvas) / <alpha-value>)',
        hairline:'rgb(var(--hairline) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)',
        pop:  '0 8px 24px rgb(16 24 40 / 0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
