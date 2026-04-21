/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#009695',
          'teal-dark': '#007A79',
          coral: '#E85D4E',
          'coral-dark': '#D14030',
          charcoal: '#0B0E14', // Deeper, more "tech" charcoal
          navy: '#0F172A',
        },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 150, 149, 0.3)',
        'glow-coral': '0 0 20px rgba(232, 93, 78, 0.3)',
      },
    },
  },
  plugins: [],
}
