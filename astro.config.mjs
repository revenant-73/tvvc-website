import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://tualatinvalleyvb.com',
  integrations: [
    tailwind(), 
    react(), 
    sitemap({
      filter: (page) => page !== 'https://tualatinvalleyvb.com/season-feedback'
    })
  ],
  adapter: netlify(),
  build: {
    format: 'file'
  }
});
