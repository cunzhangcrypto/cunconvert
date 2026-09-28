import { extFromName } from '../utils/file';
import { convertRaster } from './format';
import type { ConvertResult, CropRect } from './types';

const EXT_TO_TYPE: Record<string, 'png' | 'jpg' | 'webp'> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
};

/** 裁剪图片：输出格式与原图保持一致 */
export async function cropImage(
  file: Blob,
  crop: CropRect,
  rotate: 0 | 90 | 180 | 270 = 0,
): Promise<ConvertResult> {
  const inputExt = extFromName((file as File).name ?? '');
  const outputType = EXT_TO_TYPE[inputExt] ?? 'png';
  return convertRaster(file, {
    outputType,
    quality: 92,
    background: null,
    crop,
    rotate,
  });
}
