import { convertRaster } from './format';
import type { ConvertResult } from './types';

export interface CompressOpts {
  /** 输出格式 */
  format: 'jpg' | 'png' | 'webp';
  quality: number;
  /** 百分比缩放（可选），100 表示不缩放 */
  scale?: number;
}

/** 图片压缩：重新编码 + 可选缩放。PNG 输出为无损编码，质量参数忽略。 */
export async function compressImage(file: Blob, opts: CompressOpts): Promise<ConvertResult> {
  return convertRaster(file, {
    outputType: opts.format,
    quality: opts.format === 'png' ? undefined : opts.quality,
    scale: opts.scale && opts.scale !== 100 ? opts.scale / 100 : undefined,
    background: null,
  });
}
