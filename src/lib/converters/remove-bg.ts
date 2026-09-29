import { ConvertError } from '../utils/errors';
import { decodeToImage, assertCanvasSize } from '../image/decode';
import { canvasToBlob, MIME } from '../image/encode';
import { replaceExt, calcSaved } from '../utils/file';
import type { ConvertResult } from './types';

export interface RemoveBgOpts {
  /** 目标背景色（#RRGGBB），默认白色 */
  color?: string;
  /** 容差 0-100，越大移除越多相近色 */
  tolerance?: number;
  /** 边缘羽化：阈值附近渐变透明，减少锯齿 */
  feather?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/**
 * 去除纯色背景：把接近指定颜色的像素变为透明，输出透明 PNG。
 * 纯本地像素处理，无任何网络请求。
 */
export async function removeBg(file: Blob, opts: RemoveBgOpts = {}): Promise<ConvertResult> {
  const target = hexToRgb(opts.color ?? '#ffffff');
  if (!target) throw new ConvertError('背景色格式不正确，请使用 #RRGGBB 格式');
  const tolerance = Math.max(0, Math.min(100, opts.tolerance ?? 25));
  const feather = opts.feather !== false;

  const img = await decodeToImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new ConvertError('无法读取图片尺寸');
  assertCanvasSize(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const maxDist = Math.sqrt(3 * 255 * 255); // ~441.7
  const threshold = (tolerance / 100) * maxDist;
  const featherRange = feather ? Math.max(10, threshold * 0.4) : 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const dr = data[i] - target.r;
    const dg = data[i + 1] - target.g;
    const db = data[i + 2] - target.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= threshold) {
      data[i + 3] = 0;
    } else if (featherRange > 0 && dist < threshold + featherRange) {
      const t = (dist - threshold) / featherRange;
      data[i + 3] = Math.max(0, Math.round(a * (1 - t)));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas, 'png');
  const name = (file as File).name ?? 'image';
  return {
    blob,
    ext: 'png',
    mime: MIME.png,
    meta: {
      width: w,
      height: h,
      originalSize: file.size,
      outputSize: blob.size,
      savedPercent: calcSaved(file.size, blob.size),
    },
  };
}

/** 文件名替换为 .png（透明输出） */
export function removeBgName(name: string): string {
  return replaceExt(name, 'png');
}
