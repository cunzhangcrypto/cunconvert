import { ConvertError } from '../utils/errors';
import { computeTargetSize, type SizeOpts } from './size';

/** 画布安全上限（避免触发浏览器内存上限） */
export const MAX_CANVAS_DIM = 16384;
export const MAX_CANVAS_AREA = 268435456; // 16384 * 16384

export function assertCanvasSize(w: number, h: number): void {
  if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM || w * h > MAX_CANVAS_AREA) {
    throw new ConvertError('图片尺寸过大，浏览器可用内存不足，请尝试缩小图片后再处理');
  }
}

/** 将 Blob 解码为可绘制的 HTMLImageElement */
export function decodeToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ConvertError('无法读取该图片文件，文件可能已损坏或格式不受支持'));
    };
    img.src = url;
  });
}

export interface DrawOpts extends SizeOpts {
  background?: string | null;
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  crop?: { x: number; y: number; w: number; h: number };
}

/**
 * 将图片绘制到画布：
 * 先按 crop 取源区域，再按 scale/width/height 缩放，最后应用旋转与翻转。
 * background 为 null 表示透明背景（不填充）。
 */
export function imageToCanvas(img: HTMLImageElement, opts: DrawOpts): HTMLCanvasElement {
  const crop = opts.crop;
  const srcW = crop ? crop.w : img.naturalWidth;
  const srcH = crop ? crop.h : img.naturalHeight;
  const { width: tw, height: th } = computeTargetSize(srcW, srcH, opts);

  let outW = tw;
  let outH = th;
  if (opts.rotate === 90 || opts.rotate === 270) {
    [outW, outH] = [outH, outW];
  }
  assertCanvasSize(outW, outH);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');

  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  if (opts.rotate) ctx.rotate((opts.rotate * Math.PI) / 180);
  if (opts.flipH) ctx.scale(-1, 1);
  if (opts.flipV) ctx.scale(1, -1);
  // ⚠️ 目标框必须用**未对调**的 tw/th。
  // 旋转是交给 CTM 做的：把一个 tw×th 的框转 90° 自然就得到 outW×outH。
  // 曾经这里写成 -outW/2, -outH/2, outW, outH（对调后的尺寸），于是源矩形被
  // 非等比拉伸 —— 非正方形图旋转 90°/270° 会被压进画布**中间一半**并左右溢出，
  // 上下留出透明空带（80×40 实测：内容只占 y∈[20,60]）。2026-10-03 修复。
  ctx.drawImage(img, crop?.x ?? 0, crop?.y ?? 0, srcW, srcH, -tw / 2, -th / 2, tw, th);
  ctx.restore();

  return canvas;
}
