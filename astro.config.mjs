import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import auth from 'auth-astro';

const isPlaywright = process.env.PLAYWRIGHT_TEST === '1';
const nonIndexableSitemapPaths = [
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/portal(?:\/|$)/,
  /^\/boys-volleyball\/thanks\/?$/,
  /^\/offline\/?$/,
  /^\/outdoor-events\/?$/,
  /^\/season-feedback\/?$/,
  /^\/season-registration\/?$/,
  /^\/success\/?$/,
  /^\/training\/?$/,
  /^\/training\/book\/?$/,
];

function shouldIncludeInSitemap(page) {
  const { pathname } = new URL(page);
  return !nonIndexableSitemapPaths.some((pattern) => pattern.test(pathname));
}

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
      filter: shouldIncludeInSitemap
    })
  ],
  vite: {
    optimizeDeps: {
      force: true,
      include: ['auth-astro/client']
    }
  },
  adapter: netlify(isPlaywright ? { devFeatures: false } : undefined),
  security: {
    checkOrigin: true
  },
  build: {
    format: 'file'
  }
});
