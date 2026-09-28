import { extFromName } from '../utils/file';
import { convertRaster } from './format';
import type { ConvertResult } from './types';

export interface ResizeOpts {
  mode: 'px' | 'percent' | 'quick';
  width?: number;
  height?: number;
  lockRatio?: boolean;
  percent?: number;
  quick?: number;
}

const EXT_TO_TYPE: Record<string, 'png' | 'jpg' | 'webp'> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
};

/** 调整图片尺寸：输出格式与原图保持一致 */
export async function resizeImage(file: Blob, opts: ResizeOpts): Promise<ConvertResult> {
  const inputExt = extFromName((file as File).name ?? '');
  const outputType = EXT_TO_TYPE[inputExt] ?? 'png';

  let target: { width?: number; height?: number; scale?: number; lockRatio?: boolean } = {};
  if (opts.mode === 'percent') {
    target = { scale: (opts.percent ?? 100) / 100 };
  } else if (opts.mode === 'quick') {
    target = { width: opts.quick };
  } else {
    target = { width: opts.width, height: opts.height, lockRatio: opts.lockRatio ?? true };
  }

  return convertRaster(file, {
    outputType,
    quality: 92,
    background: null,
    ...target,
  });
}
