# CunConvert 实施计划（一次性完成 Phase 1–8）

## Context

用户提供了完整 PRD（见附件），要求在 `d:\Github\CunConvert`（空目录）从零构建 **CunConvert** —— 一个浏览器本地处理图片与 SVG 的在线工具箱（Astro + TypeScript）。核心硬性约束：**用户文件永不离开浏览器**，禁止任何 Worker API / R2 / D1 / 后端处理；Cloudflare 仅托管静态资源。约 20 个工具页面，每个必须有独立 SEO 页面、原创中文转换指南、FAQ + FAQPage Schema。用户已确认：本次会话一次性完成全部 8 个阶段。

## 关键技术决策

| 项 | 决策 |
|---|---|
| 框架 | Astro ^7.3（内置 Vite 8），纯静态输出 `dist/`，**不装 Cloudflare adapter**（无 Functions 才符合"禁止后端"）；`@astrojs/sitemap` 生成 sitemap |
| 交互 | 原生 TypeScript 客户端脚本（每工具一个 `scripts/*.ts`，由 ToolPage 按 `data-tool` 动态 import），不引入 UI 框架 |
| 样式 | 原生 CSS + CSS 变量（`styles/tokens.css` 含明/暗/跟随系统主题） |
| 图片互转/压缩/缩放 | Canvas + `toBlob`/`convertToBlob`，不引第三方 |
| SVG→位图 | `new Image()` + blob URL 绘制到 canvas（零依赖、保真度高、天然安全）；渲染前解析 viewBox 补齐 width/height |
| SVG 优化 | `svgo` ^4.1，`await import('svgo/browser')` 按需加载（~169 kB gzip） |
| 矢量化 | `imagetracerjs` 1.2.6（UMD），放 `public/vendor/imagetracer_v1.2.6.js`，动态 `<script>` 注入后取 `window.ImageTracer`（不经 Vite import） |
| ZIP | `jszip` ^3.10.2 动态 import |
| Worker | `new Worker(new URL('../../workers/image.worker.ts', import.meta.url), { type:'module' })`；Worker 内做位图解码/缩放/裁剪/旋转/翻转/编码（OffscreenCanvas + createImageBitmap），SVG→canvas 渲染与 ZIP 生成留主线程；无 OffscreenCanvas 时回退主线程 canvas+toBlob |

## 目录结构

```
d:\Github\CunConvert\
├─ package.json  astro.config.mjs  tsconfig.json  .gitignore
├─ public/
│  ├─ vendor/imagetracer_v1.2.6.js
│  ├─ favicon.svg  robots.txt
├─ src/
│  ├─ data/tools.ts            # 20 工具元数据：slug/title/desc/H1/FAQ/指南/related/关键词
│  ├─ layouts/BaseLayout.astro  ToolLayout.astro
│  ├─ components/
│  │  ├─ ToolPage.astro        # 工具页框架：H1→工具插槽→相关工具→指南→FAQ
│  │  ├─ ui/ UploadZone FileList ProgressBar DownloadButton OptionGroup
│  │  │     RatioSelector ColorPicker CompareStats CropOverlay ToolHeader
│  │  ├─ seo/ SeoHead FaqSchema SoftwareAppSchema
│  │  ├─ Header.astro  Footer.astro  ThemeToggle.astro
│  ├─ pages/                   # 首页 + 20 工具页 + privacy + about + 404
│  ├─ scripts/                 # upload.ts 公共上传 + 每工具交互脚本
│  ├─ workers/image.worker.ts
│  ├─ lib/
│  │  ├─ converters/ index.ts format.ts resize.ts compress.ts crop.ts
│  │  │               rotate-flip.ts svg-to-bitmap.ts svg-optimize.ts vectorize.ts batch.ts
│  │  ├─ image/ decode.ts encode.ts ops.ts
│  │  ├─ svg/ sanitize.ts parse.ts svgo-loader.ts
│  │  ├─ vectorizer/imagetracer-loader.ts
│  │  ├─ zip/jszip-loader.ts
│  │  ├─ worker/ protocol.ts pool.ts
│  │  └─ utils/ file.ts errors.ts   # errors.ts：所有错误映射为中文提示
│  └─ styles/ tokens.css global.css
```

## 统一转换引擎（lib/converters/index.ts）

```ts
interface ConvertOptions {
  input: File | Blob | string;              // Blob 或 SVG 文本
  inputType: 'auto'|'png'|'jpg'|'webp'|'svg';
  outputType: 'png'|'jpg'|'webp'|'svg'|'zip';
  quality?: number;                         // JPG/WebP 0-100
  background?: string | null;               // 透明/自定义背景
  width?; height?; scale?; lockRatio?;
  rotate?: 0|90|180|270; flipH?; flipV?;
  crop?: { x; y; w; h };
  trace?: { mode:'bw'|'gray'|'color'; colors?; detail?; smoothing? };
  svgo?: { simple: boolean; plugins?: string[] };
  signal?: AbortSignal;
}
interface ConvertResult { blob; ext; mime; meta:{ width; height; originalSize; outputSize; savedPercent; viewBox? } }
convert(opts): Promise<ConvertResult>
```

## SVG 安全（lib/svg/sanitize.ts）

DOMParser 解析后移除：`<script>`、所有 on* 事件属性、`href/xlink:href` 指向外部 http/data（除纯色渐变 id 引用）、`<iframe>/<object>/<embed>`、`<foreignObject>`；`<image>` 外部 src 内联为 data URL 或移除。预览一律用 blob URL 的 `<img>`，禁止 innerHTML 注入。

## 阶段实施（文件级清单）

**P1 框架**：package.json / astro.config.mjs / tsconfig / styles / BaseLayout / Header / Footer / ThemeToggle / index.astro / data/tools.ts（先建全量元数据骨架）/ privacy / about / 404。

**P2 核心转换**：lib/image/{decode,encode}.ts、lib/svg/{sanitize,parse}.ts、lib/converters/{index,format,svg-to-bitmap}.ts、lib/utils/{file,errors}.ts、scripts/{upload,format-convert}.ts、ToolPage.astro + ui 组件、7 页：svg-to-png / svg-to-jpg / svg-to-webp / png-to-jpg / png-to-webp / jpg-to-png / jpg-to-webp / webp-to-png / webp-to-jpg（9 页）。SVG→位图支持 原始尺寸/自定义宽高/锁定比例/1×–4×/透明·白·黑·自定义背景/JPG 质量。

**P3 图片处理**：lib/image/ops.ts、converters/{resize,compress,crop,rotate-flip}.ts、scripts/{resize,crop,rotate,compress}.ts、4 页 image-resizer / image-compressor / image-cropper / rotate-flip（含 CropOverlay 拖拽裁剪组件、压缩显示"原始/压缩后/节省%"）。

**P4 SVG 查看/优化**：lib/svg/svgo-loader.ts、scripts/{svg-view,svg-optimize}.ts、2 页 svg-viewer / svg-optimizer（优化器显示"原始/优化后/节省比例"，简单模式 + 高级设置折叠）。

**P5 矢量化**：public/vendor/imagetracer_v1.2.6.js、lib/vectorizer/imagetracer-loader.ts、converters/vectorize.ts、scripts/vectorize.ts、3 页 png-to-svg / jpg-to-svg / webp-to-svg（黑白/灰度/彩色，彩色含颜色数量/细节/平滑；页内醒目标注"矢量化非格式转换"提示）。

**P6 批量/性能**：workers/image.worker.ts、lib/worker/{protocol,pool}.ts、lib/zip/jszip-loader.ts、converters/batch.ts、scripts/batch.ts；所有工具页接入 Worker + 动态 import；批量页支持"正在处理 18/50"进度与"下载全部"ZIP；首页不加载任何重型库。

**P7 SEO 内容**：为全部 20 工具页撰写原创中文指南（每页 2-4 个 H2，内容差异化，不堆砌关键词）与 FAQ（每页 4-6 问）；SeoHead（title/description/canonical/OG/Twitter）+ FaqSchema（FAQPage JSON-LD）+ SoftwareAppSchema；相关工具双向内链；@astrojs/sitemap + robots.txt。

**P8 检查**：`npm run build` + `astro preview` 逐页验证；转换全链路（透明/背景/质量/缩放/批量 ZIP）；错误文案全中文；隐私页声明"文件不上传"；Network 面板确认无图片上传请求；移动端响应式（>=360px）；Lighthouse 首页性能。

## 验证方式

- `npm run dev` 本地开发验证每个工具；`npm run build && npm run preview` 验证生产产物（worker chunk、动态 import、UMD vendor 路径正确）。
- 硬性验收（对应 PRD 41 节）：Network 面板无图片上传请求；无 Worker/R2/D1 代码；批量与 ZIP 全部本地完成；SVG 优化与矢量化本地完成；重型库仅工具页加载。
- Git：初始化仓库，本地提交，**不 push**（用户要求手动确认后才推送）。

## 风险与对策

- `svgo/browser` 若被 Rolldown 处理异常 → 回退 CDN UMD + script 注入。
- iOS canvas 尺寸上限（>4096²/16384px）→ 先降采样并给中文提示。
- WebKit 忽略 JPEG 质量参数 → `toDataURL` 探测编码支持后兜底。
- createImageBitmap 不支持（老 Safari）→ 回退 `Image` + drawImage。
