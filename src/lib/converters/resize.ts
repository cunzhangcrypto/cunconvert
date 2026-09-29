import { extFromName, calcSaved } from '../utils/file';
import { ConvertError } from '../utils/errors';
import { decodeToImage, assertCanvasSize } from '../image/decode';
import { canvasToBlob, MIME, type EncodeType } from '../image/encode';
import { convertRaster } from './format';
import type { ConvertResult } from './types';

export interface ResizeOpts {
  mode: 'px' | 'percent' | 'quick';
  width?: number;
  height?: number;
  lockRatio?: boolean;
  percent?: number;
  quick?: string;
  /** 目标画幅适配方式：stretch 拉伸填满 / cover 等比铺满并居中裁剪 / blur 模糊背景填充（内容完整） */
  fit?: 'stretch' | 'cover' | 'blur';
}

const EXT_TO_TYPE: Record<string, 'png' | 'jpg' | 'webp'> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
};

/** 解析 "WxH" 或 "WxH:fit" 规格（fit: stretch/cover/blur） */
function parseSpec(spec: string): { w: number; h: number; fit: 'stretch' | 'cover' | 'blur' } | null {
  const m = spec.trim().match(/^(\d+)\s*[x×]\s*(\d+)(?::(stretch|cover|blur))?$/i);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]), fit: (m[3] as 'cover' | 'blur' | undefined) ?? 'stretch' };
}

/** 画幅适配绘制（不拉伸）：cover 等比放大居中裁剪；blur 模糊背景 + 完整内容居中 */
function drawFitted(
  img: HTMLImageElement,
  tw: number,
  th: number,
  fit: 'cover' | 'blur',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) throw new ConvertError('无法读取图片尺寸');

  if (fit === 'cover') {
    // 等比放大铺满，居中裁剪超出部分（无黑边）
    const scale = Math.max(tw / srcW, th / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    ctx.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  } else {
    // 铺不透明底色（兜底透明 PNG / 边缘羽化）
    ctx.fillStyle = '#181c26';
    ctx.fillRect(0, 0, tw, th);
    // 模糊背景：等比放大并外扩，让模糊羽化落在画幅之外（边缘不透明）
    const bgScale = Math.max(tw / srcW, th / srcH) * 1.25;
    const bw = srcW * bgScale;
    const bh = srcH * bgScale;
    ctx.filter = 'blur(40px) saturate(1.2)';
    ctx.drawImage(img, (tw - bw) / 2, (th - bh) / 2, bw, bh);
    ctx.filter = 'none';
    const fgScale = Math.min(tw / srcW, th / srcH);
    const fw = srcW * fgScale;
    const fh = srcH * fgScale;
    ctx.drawImage(img, (tw - fw) / 2, (th - fh) / 2, fw, fh);
  }
  return canvas;
}

/** 调整图片尺寸：输出格式与原图保持一致；平台预设支持 cover/blur 画幅适配 */
export async function resizeImage(file: Blob, opts: ResizeOpts): Promise<ConvertResult> {
  const inputExt = extFromName((file as File).name ?? '');
  const outputType = EXT_TO_TYPE[inputExt] ?? 'png';
  const originalSize = file.size;

  let fit: 'stretch' | 'cover' | 'blur' = opts.fit ?? 'stretch';
  let target: { width?: number; height?: number; scale?: number; lockRatio?: boolean } = {};

  if (opts.mode === 'percent') {
    target = { scale: (opts.percent ?? 100) / 100 };
  } else if (opts.mode === 'quick') {
    const q = opts.quick ?? '';
    const spec = parseSpec(q);
    if (spec) {
      target = { width: spec.w, height: spec.h, lockRatio: false };
      fit = spec.fit === 'stretch' ? fit : spec.fit;
    } else if (q !== '') {
      target = { width: Number(q) };
    }
  } else {
    target = { width: opts.width, height: opts.height, lockRatio: opts.lockRatio ?? true };
  }

  // 画幅适配（cover / blur）：不拉伸，主线程自定义绘制
  if (fit !== 'stretch' && target.width && target.height) {
    const tw = Math.max(1, Math.round(target.width));
    const th = Math.max(1, Math.round(target.height));
    assertCanvasSize(tw, th);
    const img = await decodeToImage(file);
    const canvas = drawFitted(img, tw, th, fit);
    const blob = await canvasToBlob(canvas, outputType as EncodeType, outputType === 'png' ? undefined : 92);
    return {
      blob,
      ext: outputType,
      mime: MIME[outputType],
      meta: {
        width: tw,
        height: th,
        originalSize,
        outputSize: blob.size,
        savedPercent: calcSaved(originalSize, blob.size),
      },
    };
  }

  return convertRaster(file, {
    outputType,
    quality: 92,
    background: null,
    ...target,
  });
}
