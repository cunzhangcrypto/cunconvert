import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 注意：部署时请将 site 替换为你的正式域名，例如 https://cunconvert.com
export default defineConfig({
  site: 'https://cunconvert.example.com',
  integrations: [sitemap()],
  output: 'static',
});
