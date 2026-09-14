import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeSanitize from 'rehype-sanitize';
import { readFileSync } from 'node:fs';
import { unified } from '@astrojs/markdown-remark';
import { markdownSchema } from './src/lib/markdown-policy.mjs';

const settings = JSON.parse(readFileSync(new URL('./src/site-settings.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: process.env.SITE_URL || settings.url,
  output: 'static',
  cacheDir: process.env.QY_BUILD_CACHE_DIR || './.astro',
  integrations: [sitemap({ filter: page => !/\/(account|shelf)\/?$/.test(page) })],
  markdown: { processor: unified({ rehypePlugins: [[rehypeSanitize, markdownSchema]] }) },
  vite: { server: { proxy: { '/api': 'http://127.0.0.1:4324', '/media': 'http://127.0.0.1:4324' } } },
});
