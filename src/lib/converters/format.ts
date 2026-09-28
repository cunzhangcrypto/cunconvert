import { ConvertError } from '../utils/errors';
import { calcSaved } from '../utils/file';
import { decodeToImage, imageToCanvas } from '../image/decode';
import { canvasToBlob, type EncodeType } from '../image/encode';
import { canUseWorker, runRasterJob, type RasterJobOpts } from '../worker/pool';
import type { ConvertResult, CropRect } from './types';

export interface RasterOpts {
  outputType: 'png' | 'jpg' | 'webp';
  quality?: number;
  background?: string | null;
  width?: number;
  height?: number;
  scale?: number;
  lockRatio?: boolean;
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  crop?: CropRect;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** 解析背景参数；JPG 输出不允许透明，默认白底 */
function resolveBackground(bg: string | null | undefined, outputType: string): string | null {
  if (bg && bg !== 'transparent') return bg;
  if (outputType === 'jpg') return '#ffffff';
  return null;
}

/**
 * 位图核心转换：解码 -> 缩放/裁剪/旋转/翻转 -> 编码。
 * 优先走 Web Worker（OffscreenCanvas），否则主线程 Canvas。
 */
export async function convertRaster(file: Blob, opts: RasterOpts): Promise<ConvertResult> {
  const originalSize = file.size;
  const outputType: EncodeType = opts.outputType;
  const mime = MIME[outputType];
  const background = resolveBackground(opts.background, outputType);

  // 1) 优先 Web Worker
  if (canUseWorker()) {
    try {
      const jobOpts: RasterJobOpts = {
        outputType,
        quality: outputType === 'png' ? undefined : opts.quality,
        background,
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        lockRatio: opts.lockRatio,
        rotate: opts.rotate ?? 0,
        flipH: opts.flipH,
        flipV: opts.flipV,
        crop: opts.crop,
      };
      const out = await runRasterJob(await file.arrayBuffer(), file.type || 'application/octet-stream', jobOpts);
      const blob = new Blob([out.buf], { type: out.mime });
      return {
        blob,
        ext: outputType,
        mime: out.mime,
        meta: {
          width: out.width,
          height: out.height,
          originalSize,
          outputSize: blob.size,
          savedPercent: calcSaved(originalSize, blob.size),
        },
      };
    } catch (e) {
      if (e instanceof ConvertError) throw e;
      // Worker 环境不支持等情况：回退主线程
    }
  }

  // 2) 主线程 Canvas 回退
  const img = await decodeToImage(file);
  const canvas = imageToCanvas(img, {
    background,
    rotate: opts.rotate,
    flipH: opts.flipH,
    flipV: opts.flipV,
    crop: opts.crop,
    width: opts.width,
    height: opts.height,
    scale: opts.scale,
    lockRatio: opts.lockRatio,
  });
  const blob = await canvasToBlob(canvas, outputType, outputType === 'png' ? undefined : opts.quality);
  return {
    blob,
    ext: outputType,
    mime,
    meta: {
      width: canvas.width,
      height: canvas.height,
      originalSize,
      outputSize: blob.size,
      savedPercent: calcSaved(originalSize, blob.size),
    },
  };
}
