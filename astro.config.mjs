import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 正式域名通过构建环境变量 SITE_URL 提供（如 https://cunconvert.com），
// 代码中不写死占位域名。本地开发时可省略，部署平台配置 SITE_URL 即可。
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  integrations: [sitemap()],
  output: 'static',
});
