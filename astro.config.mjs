import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 正式域名通过构建环境变量 SITE_URL 提供（如 https://cunconvert.com），
// 代码中不写死占位域名。本地开发时可省略，部署平台配置 SITE_URL 即可。

/**
 * 按需动态加载的重库清单。
 *
 * ⚠️ 必须显式列进 optimizeDeps.include —— 否则 dev 下 Vite 要等到第一次
 * `import('xxx')` 才现场预打包，此时浏览器已按旧 `?v=` 哈希发起请求，
 * 结果拿到 **504 (Outdated Optimize Dep)**，表现为「XX 引擎加载失败」。
 * 已踩过两次：jszip（PDF 拆分）与 pdf-lib（图片→PDF）。
 *
 * 预打包在启动时一次性完成（结果缓存在 node_modules/.vite），只影响 dev，
 * 对 `npm run build` 产物没有任何影响。
 *
 * 注意：imagetracer 走 public/vendor/ 的 <script> 加载，不经过 Vite，无需列入。
 */
const LAZY_DEPS = [
  'pdf-lib',
  'pdfjs-dist',
  'qrcode',
  'jszip',
  'svgo/browser',
  'marked',
  'dompurify',
  'turndown',
  'turndown-plugin-gfm',
];

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  integrations: [sitemap()],
  output: 'static',
  vite: {
    optimizeDeps: {
      include: LAZY_DEPS,
    },
  },
});
