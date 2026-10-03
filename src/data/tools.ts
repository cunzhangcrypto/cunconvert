export type ToolCategory =
  | 'svg'
  | 'convert'
  | 'image'
  | 'vector'
  | 'pdf'
  | 'qr'
  | 'favicon'
  | 'markdown';

export interface ToolMeta {
  slug: string;
  name: string;
  short: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  accept: string;
  category: ToolCategory;
  related: string[];
}

export const toolCategories: { key: ToolCategory; label: string; icon: string }[] = [
  { key: 'svg', label: 'SVG 工具', icon: '⌘' },
  { key: 'convert', label: '图片转换', icon: '⇄' },
  { key: 'image', label: '图片处理', icon: '✂' },
  { key: 'vector', label: '图片矢量化', icon: '◈' },
  { key: 'pdf', label: 'PDF 工具', icon: '▤' },
  { key: 'qr', label: '二维码', icon: '▩' },
  { key: 'favicon', label: 'Favicon', icon: '◎' },
  { key: 'markdown', label: 'Markdown', icon: '✎' },
];

export const tools: ToolMeta[] = [
  // ===== SVG 工具 =====
  {
    slug: 'svg-to-png',
    name: 'SVG → PNG',
    short: '将 SVG 矢量图导出为高清 PNG，支持 1×–4× 缩放与透明背景',
    title: 'SVG 转 PNG - 在线免费 SVG 转 PNG 工具 | CunConvert',
    description:
      '在线将 SVG 转换为 PNG。无需上传文件，所有转换均在浏览器本地完成，支持自定义尺寸、1×–4× 缩放、透明背景和批量转换。',
    h1: 'SVG 转 PNG',
    intro: '将 SVG 矢量图形转换为高清晰度 PNG 位图。支持原始尺寸、自定义尺寸与 1×–4× 倍率导出，透明背景或自定义背景都可以，所有处理都在你的浏览器本地完成。',
    accept: '.svg,image/svg+xml',
    category: 'svg',
    related: ['svg-to-jpg', 'svg-to-webp', 'svg-optimizer', 'svg-viewer', 'png-to-svg'],
  },
  {
    slug: 'svg-to-jpg',
    name: 'SVG → JPG',
    short: '将 SVG 转换为 JPG，支持尺寸与背景色设置（JPG 不支持透明）',
    title: 'SVG 转 JPG - 在线免费 SVG 转 JPG 工具 | CunConvert',
    description:
      '在线将 SVG 转换为 JPG。无需上传文件，浏览器本地完成，支持自定义尺寸、锁定比例、自定义背景色与 JPG 质量调节。',
    h1: 'SVG 转 JPG',
    intro: '将 SVG 矢量图形转换为 JPG 位图。JPG 不支持透明背景，因此需要为原图中的透明区域选择一种背景颜色，默认使用白色。',
    accept: '.svg,image/svg+xml',
    category: 'svg',
    related: ['svg-to-png', 'svg-to-webp', 'svg-optimizer', 'png-to-jpg', 'webp-to-jpg'],
  },
  {
    slug: 'svg-to-webp',
    name: 'SVG → WebP',
    short: '将 SVG 转换为 WebP，支持透明背景与有损/无损质量调节',
    title: 'SVG 转 WebP - 在线免费 SVG 转 WebP 工具 | CunConvert',
    description:
      '在线将 SVG 转换为 WebP。无需上传文件，浏览器本地完成，支持尺寸调整、透明背景、自定义背景与质量调节。',
    h1: 'SVG 转 WebP',
    intro: '将 SVG 矢量图形转换为 WebP 格式。WebP 同时支持透明背景和较高的压缩效率，适合网页使用场景。',
    accept: '.svg,image/svg+xml',
    category: 'svg',
    related: ['svg-to-png', 'svg-to-jpg', 'png-to-webp', 'jpg-to-webp', 'image-compressor'],
  },
  {
    slug: 'svg-optimizer',
    name: 'SVG 优化',
    short: '压缩 SVG 文件体积，删除冗余属性与无用节点',
    title: 'SVG 优化器 - 在线压缩 SVG 文件大小 | CunConvert',
    description:
      '在线优化 SVG 文件。无需上传文件，浏览器本地完成，自动删除无用元数据、冗余属性与无用节点，精简并优化路径。',
    h1: 'SVG 优化器',
    intro: '上传 SVG 后自动精简文件，去除冗余元数据、无用属性与节点，并优化路径数据，显示原始大小、优化后大小与节省比例。',
    accept: '.svg,image/svg+xml',
    category: 'svg',
    related: ['svg-viewer', 'svg-to-png', 'svg-to-webp', 'png-to-svg', 'image-compressor'],
  },
  {
    slug: 'svg-viewer',
    name: 'SVG 查看器',
    short: '查看 SVG 预览、尺寸、viewBox 等信息，并可一键转换',
    title: 'SVG 查看器 - 在线查看 SVG 文件信息 | CunConvert',
    description:
      '在线查看 SVG 文件。无需上传文件，浏览器本地完成，展示预览、文件大小、宽度、高度、viewBox 与文件名称，并可复制、下载或继续转换。',
    h1: 'SVG 查看器',
    intro: '上传 SVG 文件，即可查看预览图、文件大小、宽度、高度与 viewBox 信息，还可以复制代码、下载原文件或跳转到其他转换工具继续处理。',
    accept: '.svg,image/svg+xml',
    category: 'svg',
    related: ['svg-optimizer', 'svg-to-png', 'svg-to-jpg', 'svg-to-webp'],
  },

  // ===== 图片转换 =====
  {
    slug: 'png-to-jpg',
    name: 'PNG → JPG',
    short: '将 PNG 转换为 JPG，透明区域会用背景色填充',
    title: 'PNG 转 JPG - 在线免费 PNG 转 JPG 工具 | CunConvert',
    description:
      '在线将 PNG 转换为 JPG。无需上传文件，浏览器本地完成，支持透明背景处理、JPG 质量调节与批量转换。',
    h1: 'PNG 转 JPG',
    intro: '将 PNG 图片转换为 JPG。由于 JPG 不支持透明通道，原图中的透明区域会以你选择的背景色填充，默认白色。',
    accept: '.png,image/png',
    category: 'convert',
    related: ['jpg-to-png', 'png-to-webp', 'webp-to-jpg', 'image-compressor', 'image-resizer'],
  },
  {
    slug: 'png-to-webp',
    name: 'PNG → WebP',
    short: '将 PNG 转换为 WebP，体积更小，保留透明背景',
    title: 'PNG 转 WebP - 在线免费 PNG 转 WebP 工具 | CunConvert',
    description:
      '在线将 PNG 转换为 WebP。无需上传文件，浏览器本地完成，支持透明背景保留、质量调节与批量转换。',
    h1: 'PNG 转 WebP',
    intro: '将 PNG 图片转换为 WebP。WebP 保留透明背景，同时在同等画质下通常比 PNG 小得多，非常适合网页使用。',
    accept: '.png,image/png',
    category: 'convert',
    related: ['webp-to-png', 'png-to-jpg', 'jpg-to-webp', 'image-compressor', 'svg-to-webp'],
  },
  {
    slug: 'jpg-to-png',
    name: 'JPG → PNG',
    short: '将 JPG 转换为 PNG，通常用于需要透明背景或无损编辑的场景',
    title: 'JPG 转 PNG - 在线免费 JPG 转 PNG 工具 | CunConvert',
    description:
      '在线将 JPG 转换为 PNG。无需上传文件，浏览器本地完成，支持批量转换。注意：JPG 转 PNG 无法恢复已经丢失的画质。',
    h1: 'JPG 转 PNG',
    intro: '将 JPG 图片转换为 PNG 格式。PNG 支持透明背景和无损存储，适合需要再次编辑或需要透明通道的场景。',
    accept: '.jpg,.jpeg,image/jpeg',
    category: 'convert',
    related: ['png-to-jpg', 'jpg-to-webp', 'webp-to-png', 'image-resizer', 'png-to-svg'],
  },
  {
    slug: 'jpg-to-webp',
    name: 'JPG → WebP',
    short: '将 JPG 转换为 WebP，在相近画质下获得更小的文件',
    title: 'JPG 转 WebP - 在线免费 JPG 转 WebP 工具 | CunConvert',
    description:
      '在线将 JPG 转换为 WebP。无需上传文件，浏览器本地完成，支持质量调节与批量转换，适合网页性能优化。',
    h1: 'JPG 转 WebP',
    intro: '将 JPG 图片转换为 WebP。WebP 在相近画质下通常比 JPG 更小，是网页图片性能优化的常用手段。',
    accept: '.jpg,.jpeg,image/jpeg',
    category: 'convert',
    related: ['webp-to-jpg', 'jpg-to-png', 'png-to-webp', 'image-compressor', 'image-resizer'],
  },
  {
    slug: 'webp-to-png',
    name: 'WebP → PNG',
    short: '将 WebP 转换为 PNG，用于编辑或需要无损格式的场景',
    title: 'WebP 转 PNG - 在线免费 WebP 转 PNG 工具 | CunConvert',
    description:
      '在线将 WebP 转换为 PNG。无需上传文件，浏览器本地完成，支持透明背景保留与批量转换。',
    h1: 'WebP 转 PNG',
    intro: '将 WebP 图片转换为 PNG 格式。适合需要无损存储、继续编辑或兼容更旧软件的场景。',
    accept: '.webp,image/webp',
    category: 'convert',
    related: ['png-to-webp', 'webp-to-jpg', 'jpg-to-png', 'image-resizer', 'image-cropper'],
  },
  {
    slug: 'webp-to-jpg',
    name: 'WebP → JPG',
    short: '将 WebP 转换为 JPG，兼容性更好，体积更小',
    title: 'WebP 转 JPG - 在线免费 WebP 转 JPG 工具 | CunConvert',
    description:
      '在线将 WebP 转换为 JPG。无需上传文件，浏览器本地完成，支持透明背景处理、质量调节与批量转换。',
    h1: 'WebP 转 JPG',
    intro: '将 WebP 图片转换为 JPG。JPG 兼容性最好，几乎任何设备与软件都能打开，适合分享与通用场景。',
    accept: '.webp,image/webp',
    category: 'convert',
    related: ['jpg-to-webp', 'webp-to-png', 'png-to-jpg', 'image-compressor', 'image-resizer'],
  },

  // ===== 图片处理 =====
  {
    slug: 'image-compressor',
    name: '图片压缩',
    short: '压缩 JPG / PNG / WebP，显示压缩前后大小与节省比例',
    title: '在线图片压缩 - 免费压缩 JPG、PNG、WebP | CunConvert',
    description:
      '在线压缩 JPG、PNG、WebP 图片。无需上传文件，浏览器本地完成，可设置质量、输出格式与输出尺寸，显示压缩后大小与节省比例。',
    h1: '在线图片压缩',
    intro: '上传图片，调整压缩质量或输出格式，即可在本地压缩图片体积。处理过程不会离开你的浏览器。',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    category: 'image',
    related: ['image-resizer', 'png-to-webp', 'jpg-to-webp', 'svg-to-webp', 'image-cropper'],
  },
  {
    slug: 'image-resizer',
    name: '调整图片尺寸',
    short: '按像素、百分比或快捷尺寸缩放图片，保持比例不拉伸',
    title: '在线调整图片尺寸 - 免费图片缩放工具 | CunConvert',
    description:
      '在线调整图片尺寸。无需上传文件，浏览器本地完成，支持按像素、百分比与快捷尺寸缩放，锁定比例，避免拉伸变形。',
    h1: '调整图片尺寸',
    intro: '按像素、百分比或快捷尺寸调整图片大小。支持锁定比例与自定义宽高，不会默认拉伸图片。',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    category: 'image',
    related: ['image-compressor', 'image-cropper', 'image-rotate-flip', 'jpg-to-webp', 'png-to-jpg'],
  },
  {
    slug: 'image-cropper',
    name: '图片裁剪',
    short: '自由裁剪图片，支持 1:1、4:3、16:9 等固定比例',
    title: '在线裁剪图片 - 免费图片裁剪工具 | CunConvert',
    description:
      '在线裁剪图片。无需上传文件，浏览器本地完成，支持自由裁剪与 1:1、4:3、3:2、16:9、9:16 固定比例，可旋转与翻转。',
    h1: '裁剪图片',
    intro: '自由拖动裁剪区域或选择固定比例裁剪图片。裁剪过程完全在浏览器本地完成。',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    category: 'image',
    related: ['image-resizer', 'image-rotate-flip', 'image-compressor', 'webp-to-png', 'jpg-to-png'],
  },
  {
    slug: 'remove-background',
    name: '去除图片背景',
    short: '移除纯色背景（白底、绿幕等），一键变为透明 PNG',
    title: '在线去除图片背景 - 免费去白底变透明 PNG | CunConvert',
    description:
      '在线去除图片背景。无需上传文件，浏览器本地完成，支持白底、绿幕等纯色背景移除，可调节容差与边缘羽化，输出透明 PNG。',
    h1: '去除图片背景',
    intro: '选择要去除的背景颜色，将与之接近的像素变为透明，得到透明底 PNG。适合白底证件照、绿幕素材与纯色背景的商品图。',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    category: 'image',
    related: ['image-cropper', 'png-to-svg', 'image-resizer', 'webp-to-png', 'jpg-to-png'],
  },
  {
    slug: 'image-rotate-flip',
    name: '旋转与翻转',
    short: '旋转图片 90°/180°/270°，水平或垂直翻转',
    title: '在线旋转图片 - 免费图片旋转与翻转工具 | CunConvert',
    description:
      '在线旋转与翻转图片。无需上传文件，浏览器本地完成，支持 90°/180°/270° 旋转、水平翻转与垂直翻转，可同时旋转并翻转。',
    h1: '旋转与翻转图片',
    intro: '将图片旋转 90°、180° 或 270°，也可以水平、垂直翻转。旋转和翻转可以同时使用。',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    category: 'image',
    related: ['image-cropper', 'image-resizer', 'image-compressor', 'png-to-jpg', 'webp-to-png'],
  },

  // ===== 图片矢量化 =====
  {
    slug: 'png-to-svg',
    name: 'PNG → SVG',
    short: '将 PNG 图像矢量化，适合 Logo、图标与线稿',
    title: 'PNG 转 SVG - 在线图片矢量化工具 | CunConvert',
    description:
      '在线将 PNG 转换为 SVG 矢量图。无需上传文件，浏览器本地完成，支持黑白、灰度与彩色模式，可调节颜色数量、细节与平滑程度。',
    h1: 'PNG 转 SVG',
    intro: '将 PNG 图像矢量化转换为 SVG。注意：这是矢量化处理，并不是简单格式转换，简单 Logo、图标和线稿效果最好。',
    accept: '.png,image/png',
    category: 'vector',
    related: ['jpg-to-svg', 'webp-to-svg', 'svg-optimizer', 'svg-viewer', 'svg-to-png'],
  },
  {
    slug: 'jpg-to-svg',
    name: 'JPG → SVG',
    short: '将 JPG 图像矢量化，Logo 与图标效果最佳',
    title: 'JPG 转 SVG - 在线图片矢量化工具 | CunConvert',
    description:
      '在线将 JPG 转换为 SVG 矢量图。无需上传文件，浏览器本地完成，支持黑白、灰度与彩色模式，适合 Logo、图标与线稿。',
    h1: 'JPG 转 SVG',
    intro: '将 JPG 图像矢量化转换为 SVG。矢量化适合简单图形；复杂照片会产生大量路径，导致 SVG 文件偏大。',
    accept: '.jpg,.jpeg,image/jpeg',
    category: 'vector',
    related: ['png-to-svg', 'webp-to-svg', 'svg-optimizer', 'svg-to-png', 'svg-to-webp'],
  },
  {
    slug: 'webp-to-svg',
    name: 'WebP → SVG',
    short: '将 WebP 图像矢量化，适合 Logo、图标与线稿',
    title: 'WebP 转 SVG - 在线图片矢量化工具 | CunConvert',
    description:
      '在线将 WebP 转换为 SVG 矢量图。无需上传文件，浏览器本地完成，支持黑白、灰度与彩色模式，可调节颜色数量与细节。',
    h1: 'WebP 转 SVG',
    intro: '将 WebP 图像矢量化转换为 SVG。矢量化更适合简单 Logo、图标与黑白图形，而非复杂照片。',
    accept: '.webp,image/webp',
    category: 'vector',
    related: ['png-to-svg', 'jpg-to-svg', 'svg-optimizer', 'svg-viewer', 'svg-to-png'],
  },

  // ===== PDF 工具 =====
  {
    slug: 'image-to-pdf',
    name: '图片 → PDF',
    short: '将多张 PNG / JPG / WebP 图片合并为一个多页 PDF',
    title: '图片转 PDF - 在线免费多图合并 PDF 工具 | CunConvert',
    description:
      '在线将多张图片合并为一个 PDF。无需上传文件，浏览器本地完成，支持 PNG、JPG、WebP，可调整图片顺序、页面方向、页面尺寸与边距。',
    h1: '图片转 PDF',
    intro:
      '把多张图片合并成一个多页 PDF。可以拖拽调整顺序、选择 A4 或原图尺寸、设置横向或纵向与页面边距，所有处理都在你的浏览器本地完成。',
    accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
    category: 'pdf',
    related: ['pdf-to-image', 'pdf-merge', 'pdf-split', 'pdf-organize'],
  },
  {
    slug: 'pdf-to-image',
    name: 'PDF → 图片',
    short: '将 PDF 每一页导出为 PNG / JPG / WebP 图片',
    title: 'PDF 转图片 - 在线免费 PDF 转 PNG / JPG 工具 | CunConvert',
    description:
      '在线将 PDF 每一页转换为图片。无需上传文件，浏览器本地完成，支持 PNG、JPG、WebP 输出，可选择指定页面、调节分辨率与质量并批量下载。',
    h1: 'PDF 转图片',
    intro:
      '把 PDF 的每一页渲染成图片。支持选择全部页面或指定页面，输出 PNG / JPG / WebP，可调节清晰度与质量，并一键打包下载。',
    accept: '.pdf,application/pdf',
    category: 'pdf',
    related: ['image-to-pdf', 'pdf-merge', 'pdf-split', 'pdf-organize'],
  },
  {
    slug: 'pdf-merge',
    name: 'PDF 合并',
    short: '将多个 PDF 按顺序合并成一个 PDF',
    title: 'PDF 合并 - 在线免费合并多个 PDF 文件 | CunConvert',
    description:
      '在线合并多个 PDF。无需上传文件，浏览器本地完成，可按需要调整文件顺序，把多个 PDF 依次拼接为一个 PDF，不改变原有内容。',
    h1: 'PDF 合并',
    intro:
      '把多个 PDF 合并成一个。可以拖拽或用 ↑ ↓ 调整文件顺序，每个 PDF 的页面会按原顺序依次拼接，全程在浏览器本地完成。',
    accept: '.pdf,application/pdf',
    category: 'pdf',
    related: ['pdf-split', 'pdf-organize', 'pdf-to-image', 'image-to-pdf'],
  },
  {
    slug: 'pdf-split',
    name: 'PDF 拆分',
    short: '按每页、选中页或每 N 页把 PDF 拆成多份',
    title: 'PDF 拆分 - 在线免费拆分 PDF 页面 | CunConvert',
    description:
      '在线拆分 PDF。无需上传文件，浏览器本地完成，支持每页单独拆分、按选中页拆分、每 N 页一组，并可一键打包 ZIP 下载。',
    h1: 'PDF 拆分',
    intro:
      '把一个 PDF 拆成多份。可以每页单独拆、只拆出勾选的页面，或每 N 页合成一份，拆完的结果可一键打包下载。',
    accept: '.pdf,application/pdf',
    category: 'pdf',
    related: ['pdf-merge', 'pdf-organize', 'pdf-to-image', 'image-to-pdf'],
  },
  {
    slug: 'pdf-organize',
    name: 'PDF 页面管理',
    short: '删除、调整顺序、旋转 PDF 页面后导出',
    title: 'PDF 页面管理 - 在线删除、排序与旋转 PDF 页面 | CunConvert',
    description:
      '在线整理 PDF 页面。无需上传文件，浏览器本地完成，支持删除不需要的页面、调整页面顺序、旋转页面方向，然后导出新的 PDF。',
    h1: 'PDF 页面管理',
    intro:
      '整理 PDF 的页面：删掉不需要的页、调整先后顺序、旋转页面方向，处理完直接导出新的 PDF，所有操作都在浏览器本地完成。',
    accept: '.pdf,application/pdf',
    category: 'pdf',
    related: ['pdf-merge', 'pdf-split', 'pdf-to-image', 'image-to-pdf'],
  },

  // ===== 二维码 =====
  {
    slug: 'qr-generator',
    name: '二维码生成',
    short: '输入网址或文本实时生成二维码，支持批量生成与 PNG / SVG 下载',
    title: '二维码生成器 - 在线免费生成二维码 | CunConvert',
    description:
      '在线生成二维码。无需上传内容，浏览器本地生成，分网址、文本、批量三个版块，可自定义尺寸、边距与颜色，支持 PNG 与 SVG 下载。',
    h1: '二维码生成器',
    intro:
      '分「网址链接」「文本生成」「批量生成」三个版块，实时生成二维码。可以调整尺寸、边距与前景背景色，下载为 PNG 或矢量 SVG；批量版块支持一次生成多个并打包下载。内容不会离开你的浏览器。',
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    category: 'qr',
    related: ['favicon-generator', 'svg-to-png', 'image-resizer', 'image-compressor'],
  },

  // ===== Favicon =====
  {
    slug: 'favicon-generator',
    name: 'Favicon 生成',
    short: '上传 Logo 一键生成网站图标全套尺寸与 favicon.ico',
    title: 'Favicon 生成器 - 在线生成网站图标 ico 与多尺寸 PNG | CunConvert',
    description:
      '在线上传图片生成网站 favicon。无需上传文件，浏览器本地完成，自动生成 16/32/180/192/512 多尺寸 PNG、favicon.ico，并可打包 ZIP 下载与复制 HTML 引用代码。',
    h1: 'Favicon 生成器',
    intro:
      '上传一张 Logo 或图片，自动生成网站常用的全套图标（含 favicon.ico 与多尺寸 PNG），一键打包下载，并附上可直接粘贴的 HTML 引用代码。',
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    category: 'favicon',
    related: ['image-resizer', 'image-cropper', 'remove-background', 'qr-generator'],
  },

  // ===== Markdown =====
  {
    slug: 'markdown-editor',
    name: 'Markdown 编辑器',
    short: '编辑预览 Markdown，还能把网页文章 / HTML 转成 Markdown',
    title: 'Markdown 编辑器 - 在线实时预览与 HTML 转 Markdown | CunConvert',
    description:
      '在线 Markdown 编辑器。左侧编辑右侧实时预览，浏览器本地解析，支持导入导出 .md、导出与复制 HTML、本地草稿保存，还能把网页文章或 HTML 一键转成 Markdown。',
    h1: 'Markdown 编辑器',
    intro:
      '一个干净、完全本地运行的 Markdown 编辑器：左边写，右边实时预览，支持导入导出 .md、导出 HTML，草稿自动保存在浏览器里。另设「文章 / HTML 转 Markdown」版块，粘贴网页正文或 HTML 源码即可转成 Markdown。',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    category: 'markdown',
    related: ['image-to-pdf', 'qr-generator', 'favicon-generator', 'svg-viewer'],
  },
];

export const toolMap: Record<string, ToolMeta> = Object.fromEntries(tools.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolMeta | undefined {
  return toolMap[slug];
}

export function relatedTools(meta: ToolMeta): ToolMeta[] {
  return meta.related
    .map((s) => toolMap[s])
    .filter((t): t is ToolMeta => Boolean(t));
}

export function toolsByCategory(cat: ToolCategory): ToolMeta[] {
  return tools.filter((t) => t.category === cat);
}
