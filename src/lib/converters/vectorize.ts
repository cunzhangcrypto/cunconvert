import { ConvertError } from '../utils/errors';
import { calcSaved } from '../utils/file';
import { decodeToImage, assertCanvasSize } from '../image/decode';
import { buildTracerOptions, loadImageTracer } from '../vectorizer/imagetracer-loader';
import type { ConvertResult, TraceOptions } from './types';

/** 消除半透明抗锯齿像素：alpha 低于阈值变全透明，其余变不透明（去羽化） */
function hardenAlpha(data: Uint8ClampedArray, threshold = 160): void {
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < threshold) {
      data[i] = 0;
    } else if (a < 255) {
      data[i] = 255;
    }
  }
}

/** 灰度化：灰度/黑白模式真正去掉颜色（亮度加权），保证与彩色模式效果不同 */
function grayscalePixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = lum;
  }
}

/** 图片矢量化：解码 -> 去羽化 -> ImageTracer 生成 SVG 路径文本 */
export async function vectorizeImage(file: Blob, opts: TraceOptions): Promise<ConvertResult> {
  const originalSize = file.size;
  const img = await decodeToImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new ConvertError('无法读取该图片的尺寸');
  assertCanvasSize(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);

  // 去羽化：消除边缘抗锯齿的半透明像素（它们会被 ImageTracer 聚合成碎片色块）。
  // alpha 低于阈值 -> 全透明；否则 -> 不透明。
  hardenAlpha(imageData.data);
  // 灰度/黑白模式先真正去色，否则与彩色结果几乎一样
  if (opts.mode !== 'color') grayscalePixels(imageData.data);

  const tracer = await loadImageTracer();
  const svgText = tracer.imagedataToSVG(imageData, buildTracerOptions(opts));
  if (!svgText || !svgText.includes('<svg')) {
    throw new ConvertError('矢量化失败，请尝试降低细节或平滑参数');
  }

  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  return {
    blob,
    ext: 'svg',
    mime: 'image/svg+xml',
    meta: {
      width: w,
      height: h,
      originalSize,
      outputSize: blob.size,
      savedPercent: calcSaved(originalSize, blob.size),
    },
  };
}
