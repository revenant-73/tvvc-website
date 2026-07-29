import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import auth from 'auth-astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://tualatinvalleyvb.com',
  output: 'server',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  integrations: [
    tailwind(), 
    react(), 
    auth(),
    sitemap({
      filter: (page) => page !== 'https://tualatinvalleyvb.com/season-feedback'
    })
  ],
  vite: {
    optimizeDeps: {
      force: true,
      include: ['auth-astro/client']
    }
  },
  adapter: netlify(),
  security: {
    checkOrigin: true
  },
  build: {
    format: 'file'
  }
});
