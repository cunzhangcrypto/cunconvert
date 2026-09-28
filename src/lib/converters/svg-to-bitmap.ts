import { ConvertError } from '../utils/errors';
import { calcSaved } from '../utils/file';
import { assertCanvasSize, decodeToImage } from '../image/decode';
import { canvasToBlob, type EncodeType } from '../image/encode';
import { getSvgInfo, buildRenderableSvg } from '../svg/parse';
import { sanitizeSvg } from '../svg/sanitize';
import { computeTargetSize } from '../image/size';
import type { ConvertResult } from './types';

export interface SvgBitmapOpts {
  outputType: 'png' | 'jpg' | 'webp';
  width?: number;
  height?: number;
  scale?: number;
  lockRatio?: boolean;
  background?: string | null;
  quality?: number;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** 将 SVG 渲染为位图：解析尺寸 -> 安全清洗 -> 补尺寸 -> <img> 解码 -> 绘制 -> 编码 */
export async function svgToBitmap(file: Blob, opts: SvgBitmapOpts): Promise<ConvertResult> {
  const originalSize = file.size;
  const text = await file.text();
  const info = getSvgInfo(text);
  const naturalW = info.width ?? 0;
  const naturalH = info.height ?? 0;
  if (!naturalW || !naturalH) {
    throw new ConvertError('无法确定该 SVG 的尺寸，请检查文件是否包含 width/height 或 viewBox 属性');
  }

  const { width, height } = computeTargetSize(naturalW, naturalH, opts);
  assertCanvasSize(width, height);

  const safe = sanitizeSvg(text);
  const renderable = buildRenderableSvg(safe, { width, height });
  const svgBlob = new Blob([renderable], { type: 'image/svg+xml' });
  const img = await decodeToImage(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');

  const outputType: EncodeType = opts.outputType;
  const background = opts.background && opts.background !== 'transparent' ? opts.background : outputType === 'jpg' ? '#ffffff' : null;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, outputType, outputType === 'png' ? undefined : opts.quality);
  return {
    blob,
    ext: outputType,
    mime: MIME[outputType],
    meta: {
      width,
      height,
      originalSize,
      outputSize: blob.size,
      savedPercent: calcSaved(originalSize, blob.size),
      viewBox: info.viewBox,
    },
  };
}
