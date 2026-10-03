import { ConvertError } from '../utils/errors';
import { decodeToImage } from '../image/decode';
import { canvasToBlob } from '../image/encode';

export interface FaviconOpts {
  /** contain = 完整显示（可能留边）；cover = 铺满裁剪 */
  fit: 'contain' | 'cover';
  /** 背景色，null 表示透明 */
  background: string | null;
  /** 内边距百分比 0-20 */
  padding: number;
}

export const FAVICON_DEFAULTS: FaviconOpts = {
  fit: 'contain',
  background: null,
  padding: 0,
};

/** 需要生成的 PNG 规格 */
const PNG_SPECS: { size: number; name: string; opaque?: boolean }[] = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon.png', opaque: true },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
];

/** .ico 内嵌的规格 */
const ICO_SIZES = [16, 32, 48];

function drawIcon(
  img: HTMLImageElement,
  size: number,
  opts: FaviconOpts,
  forceOpaque: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');

  const bg = forceOpaque ? (opts.background ?? '#ffffff') : opts.background;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const pad = (Math.max(0, Math.min(20, opts.padding)) / 100) * size;
  const box = Math.max(1, size - pad * 2);
  const scale =
    opts.fit === 'cover' ? Math.max(box / srcW, box / srcH) : Math.min(box / srcW, box / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return canvas;
}

/** 组装 ICO 容器（每个条目直接内嵌 PNG，Windows Vista+ 与主流浏览器均支持） */
function buildIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerSize = 6;
  const dirSize = 16 * entries.length;
  const dataStart = headerSize + dirSize;
  const total = dataStart + entries.reduce((sum, e) => sum + e.png.length, 0);

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: 1 = icon
  dv.setUint16(4, entries.length, true);

  let p = headerSize;
  let dataOffset = dataStart;
  for (const e of entries) {
    out[p] = e.size >= 256 ? 0 : e.size; // width（256 记 0）
    out[p + 1] = e.size >= 256 ? 0 : e.size; // height
    out[p + 2] = 0; // 调色板数
    out[p + 3] = 0; // reserved
    dv.setUint16(p + 4, 1, true); // color planes
    dv.setUint16(p + 6, 32, true); // bits per pixel
    dv.setUint32(p + 8, e.png.length, true);
    dv.setUint32(p + 12, dataOffset, true);
    p += 16;
    dataOffset += e.png.length;
  }

  let o = dataStart;
  for (const e of entries) {
    out.set(e.png, o);
    o += e.png.length;
  }
  return out;
}

/** 由一张图片生成整套网站图标（含 favicon.ico），全部本地完成 */
export async function generateFaviconSet(
  blob: Blob,
  opts: FaviconOpts,
): Promise<{ name: string; blob: Blob }[]> {
  const img = await decodeToImage(blob);
  if (!img.naturalWidth || !img.naturalHeight) throw new ConvertError('无法读取图片尺寸');

  const out: { name: string; blob: Blob }[] = [];
  const pngCache = new Map<number, Uint8Array>();

  for (const spec of PNG_SPECS) {
    const canvas = drawIcon(img, spec.size, opts, Boolean(spec.opaque));
    const png = await canvasToBlob(canvas, 'png');
    out.push({ name: spec.name, blob: png });
    if (ICO_SIZES.includes(spec.size)) {
      pngCache.set(spec.size, new Uint8Array(await png.arrayBuffer()));
    }
  }

  // 48 不在 PNG 列表里时补渲染一次，供 .ico 使用
  for (const size of ICO_SIZES) {
    if (!pngCache.has(size)) {
      const canvas = drawIcon(img, size, opts, false);
      const png = await canvasToBlob(canvas, 'png');
      pngCache.set(size, new Uint8Array(await png.arrayBuffer()));
    }
  }

  const ico = buildIco(ICO_SIZES.map((size) => ({ size, png: pngCache.get(size)! })));
  out.unshift({ name: 'favicon.ico', blob: new Blob([ico as BlobPart], { type: 'image/x-icon' }) });

  return out;
}

/** 生成对应的 HTML 引用代码 */
export function faviconHtmlCode(): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">',
  ].join('\n');
}
