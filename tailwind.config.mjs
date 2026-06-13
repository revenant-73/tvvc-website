/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#008281',
          'teal-dark': '#006B6A',
          coral: '#C13D2F',
          'coral-dark': '#A03226',
          charcoal: '#0B0E14', // Deeper, more "tech" charcoal
          navy: '#0F172A',
        },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        syne: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 130, 129, 0.3)',
        'glow-coral': '0 0 20px rgba(193, 61, 47, 0.3)',
      },
    },
  },
  plugins: [],
}
