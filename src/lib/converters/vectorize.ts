import { ConvertError } from '../utils/errors';
import { calcSaved } from '../utils/file';
import { decodeToImage, assertCanvasSize } from '../image/decode';
import { buildTracerOptions, loadImageTracer } from '../vectorizer/imagetracer-loader';
import type { ConvertResult, TraceOptions } from './types';

/** 图片矢量化：解码 -> 像素采样 -> ImageTracer 生成 SVG 路径文本 */
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
