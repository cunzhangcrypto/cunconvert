import { extFromName } from '../utils/file';
import { convertRaster } from './format';
import type { ConvertResult } from './types';

const EXT_TO_TYPE: Record<string, 'png' | 'jpg' | 'webp'> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
};

export interface RotateFlipOpts {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

/** 旋转与翻转：输出格式与原图保持一致 */
export async function rotateFlipImage(file: Blob, opts: RotateFlipOpts): Promise<ConvertResult> {
  const inputExt = extFromName((file as File).name ?? '');
  const outputType = EXT_TO_TYPE[inputExt] ?? 'png';
  return convertRaster(file, {
    outputType,
    quality: 92,
    background: null,
    rotate: opts.rotate,
    flipH: opts.flipH,
    flipV: opts.flipV,
  });
}
