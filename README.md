# CunConvert

> 本地图片与 SVG 工具箱 —— 所有文件在浏览器本地处理，不会上传到任何服务器。

CunConvert 是一个**隐私优先**的图片与 SVG 在线工具箱：格式互转、压缩、调整尺寸、裁剪、旋转翻转、SVG 优化与查看、图片矢量化、去背景，共 19 个工具。所有处理都通过浏览器内置的 Canvas、Web Worker 与开源库在**你的设备上**完成——文件不出设备，无需注册，也没有上传等待。

## ✨ 功能

| 分类 | 工具 |
|---|---|
| **SVG 工具** | SVG → PNG / JPG / WebP、SVG 优化、SVG 查看器 |
| **图片转换** | PNG ↔ JPG、PNG ↔ WebP、JPG ↔ WebP 互转 |
| **图片处理** | 图片压缩、调整尺寸、裁剪、旋转与翻转、去除图片背景 |
| **图片矢量化** | PNG / JPG / WebP → SVG |

通用能力：

- 🖥️ **本地处理**：全部在浏览器本地完成，无后端、无上传、无追踪
- 📦 **批量处理**：一次选择多个文件，顺序转换，一键打包 ZIP 下载
- 🎨 **明暗主题**：浅色 / 深色 / 跟随系统
- 📱 **响应式**：桌面与移动端均可使用
- 🔒 **隐私安全**：无需注册，文件永远不会离开设备
- 🚀 **按需加载**：SVGO / JSZip / ImageTracer 等重库仅在对应工具使用时动态加载

## 🛠 技术栈

- [Astro](https://astro.build)（静态站点，`output: 'static'`）
- TypeScript + 原生 CSS（无 UI 框架）
- Canvas + Web Worker + OffscreenCanvas（图片处理）
- [SVGO](https://github.com/svg/svgo)（SVG 优化，动态导入）
- [JSZip](https://stuk.github.io/jszip/)（ZIP 打包，动态导入）
- [ImageTracer](https://github.com/jankovicsandras/imagetracerjs)（图片矢量化，本地 vendor 加载）

## 📂 项目结构

```
src/
├── data/            # 工具元数据、工具图标、指南内容
├── lib/
│   ├── converters/  # 转换引擎（互转/压缩/尺寸/裁剪/旋转/矢量化/去背景）
│   ├── image/       # 解码、画布尺寸校验、编码（toBlob / OffscreenCanvas）
│   ├── svg/         # SVG 解析、安全清洗、SVGO 封装
│   ├── utils/       # 错误映射（中文提示）、文件工具
│   ├── vectorizer/  # ImageTracer 加载器与参数映射
│   ├── worker/      # Web Worker 池（RasterJob）
│   └── zip/         # JSZip 动态加载
├── components/      # 布局与 UI 组件（Header/Footer/ConvertShell/ToolPage…）
├── scripts/         # 各工具的前端交互脚本
├── pages/           # 22+ 页面（首页 + 各工具页 + 隐私/关于/404）
├── layouts/         # BaseLayout（含全站动态背景层）
└── styles/          # 设计 token（Mintlify 风格色板）与全局样式
public/
└── vendor/          # imagetracer_v1.2.6.js（本地加载，避免 CDN 依赖）
```

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:4321）
npm run dev

# 类型检查
npx tsc --noEmit

# 生产构建（输出到 dist/）
npm run build

# 本地预览构建产物
npm run preview
```

> ⚠️ **正式域名通过构建环境变量 `SITE_URL` 提供**（例如 `https://pic.czlab.dev`），代码中没有写死任何域名。本地开发可以省略该变量；部署时在平台的环境变量中配置 `SITE_URL` 后重新构建，sitemap 与 canonical 链接才会指向正确地址。

## ☁️ 部署

CunConvert 是纯静态站点，部署后**不需要任何服务器、函数或数据库**——所有工具逻辑都运行在访问者的浏览器里。部署完成后，再在域名管理面板把域名绑定到平台即可（无需改代码）。

### 部署到 Vercel

1. 将项目推送到 GitHub 仓库，然后在 [vercel.com](https://vercel.com) 点击 **Add New → Project**，导入该仓库。
2. Vercel 会自动识别 Astro 项目，无需手动配置；如需手动确认，使用以下配置：
   - **Framework Preset**：`Astro`
   - **Build Command**：`npm run build`
   - **Output Directory**：`dist`
3. 在 **Settings → Environment Variables** 添加变量：`SITE_URL` = `https://你的正式域名`（如 `https://pic.czlab.dev`），然后 **Redeploy**。
4. 点击 **Deploy**，等待构建完成。
5. 在 **Settings → Domains** 绑定你的正式域名（或使用 Vercel 提供的 `.vercel.app` 域名）。

### 部署到 Cloudflare Pages

**方式一：仪表盘（推荐新手）**

1. 将项目推送到 GitHub 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择仓库，使用以下构建设置：
   - **Framework preset**：`Astro`
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
4. 在 **Settings → Environment variables** 添加：`SITE_URL` = `https://你的正式域名`，然后重新部署。
5. 点击 **Save and Deploy**。每次推送到分支都会自动触发构建。
6. 在 **Custom domains** 中绑定你的域名（Cloudflare 会自动为 Pages 提供免费 CDN 与 HTTPS）。

**方式二：Wrangler CLI（命令行）**

```bash
# 本地构建（指定正式域名）
SITE_URL=https://你的正式域名 npm run build

# 安装并登录 Wrangler
npx wrangler login

# 上传 dist/ 到 Pages（项目名可自定义）
npx wrangler pages deploy dist --project-name cunconvert
```

> 注意：`public/vendor/imagetracer_v1.2.6.js` 会随构建产物自动包含在 `dist/` 中，无需额外配置。请勿将其改为外部 CDN 引用。

## ☕ 打赏支持

如果 CunConvert 帮到了你，欢迎请村长喝杯咖啡～你的支持是持续更新的动力。

| 微信 | 支付宝 | USDT（BEP20） | USDT（TRC20） |
|---|---|---|---|
| <img src="/donate/wechat.png" width="160" alt="微信收款码" /> | <img src="/donate/alipay.png" width="160" alt="支付宝收款码" /> | <img src="/donate/usdtbep20.png" width="160" alt="USDT BEP20 收款码" /> | <img src="/donate/usdttrc20.png" width="160" alt="USDT TRC20 收款码" /> |

## 🕊️ 隐私声明

- 所有图片与 SVG 文件**只在浏览器本地处理**，项目源码中不存在任何 `fetch` / `XHR` / 上传逻辑。
- 不使用任何后端、数据库、第三方 AI API 或分析追踪。
- 生成的图片、ZIP 等文件仅保存在你自己的设备中。

## 📮 联系方式

- **村长博客**：https://cunzhangblog.com
- **村长实验室**：https://czlab.dev
- **联系村长**：cunzhang@czlab.dev

## 📄 许可证

[MIT](LICENSE)
