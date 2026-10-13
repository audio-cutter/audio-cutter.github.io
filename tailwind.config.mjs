/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'deep-burgundy': '#790D16',
        'tan-beige': '#E5D3AF',
        'cream-white': '#F5EFE1',
        'slate-blue': '#AEC4D4',
        burgundy: {
          DEFAULT: '#790D16',
          hover: '#5E0A11',
          light: '#96121D',
        },
        beige: {
          DEFAULT: '#E5D3AF',
          dark: '#D6C096',
        },
        cream: {
          DEFAULT: '#F5EFE1',
        },
        waveform: {
          DEFAULT: '#AEC4D4',
          active: '#7FA3BC',
        },
        charcoal: {
          DEFAULT: '#121316',
          surface: '#1C1E24',
          elevated: '#252830',
          border: '#2E323B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        minimal: '0 4px 24px -4px rgba(121, 13, 22, 0.06)',
        'minimal-dark': '0 4px 24px -4px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
