/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg) / <alpha-value>)',
        fg: 'hsl(var(--fg) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          light: 'hsl(var(--primary-light) / <alpha-value>)',
          dark: 'hsl(var(--primary-dark) / <alpha-value>)',
          fg: 'hsl(var(--primary-fg) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          fg: 'hsl(var(--secondary-fg) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          fg: 'hsl(var(--muted-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          fg: 'hsl(var(--accent-fg) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          light: 'hsl(var(--destructive-light) / <alpha-value>)',
          fg: 'hsl(var(--destructive-fg) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        sidebar: {
          bg: 'var(--sidebar-bg)',
          fg: 'var(--sidebar-fg)',
          hover: 'var(--sidebar-hover)',
          active: 'hsl(var(--primary) / <alpha-value>)',
        },
        stat: {
          1: 'hsl(var(--stat-1) / <alpha-value>)',
          2: 'hsl(var(--stat-2) / <alpha-value>)',
          3: 'hsl(var(--stat-3) / <alpha-value>)',
          4: 'hsl(var(--stat-4) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)',
        lg: '0 10px 25px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};