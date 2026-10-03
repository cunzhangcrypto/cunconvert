import { extFromName } from '../utils/file';
import { convertRaster } from './format';
import type { ConvertResult, CropRect } from './types';

const EXT_TO_TYPE: Record<string, 'png' | 'jpg' | 'webp'> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
};

export interface CropOpts {
  crop: CropRect;
  /**
   * 引擎内部顺序是「先按 crop 取原图区域，再旋转/翻转」。
   * 裁剪工具的界面是「先旋转、再拖框」，靠 `scripts/crop.ts` 把框**逆变换**回
   * 原图坐标来实现 —— 两者等价（T 是刚体变换，crop∘T == T∘crop∘T⁻¹）。
   */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

/** 裁剪图片：输出格式与原图保持一致 */
export async function cropImage(file: Blob, opts: CropOpts): Promise<ConvertResult> {
  const inputExt = extFromName((file as File).name ?? '');
  const outputType = EXT_TO_TYPE[inputExt] ?? 'png';
  return convertRaster(file, {
    outputType,
    quality: 92,
    background: null,
    crop: opts.crop,
    rotate: opts.rotate,
    flipH: opts.flipH,
    flipV: opts.flipV,
  });
}
