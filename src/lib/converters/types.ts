/** 转换引擎的公共类型 */

export type OutputType = 'png' | 'jpg' | 'webp' | 'svg';

export interface ConvertMeta {
  width: number;
  height: number;
  originalSize: number;
  outputSize: number;
  /** 节省百分比，负数表示体积增大 */
  savedPercent: number;
  viewBox?: string;
}

export interface ConvertResult {
  blob: Blob;
  /** 输出扩展名（不含点），如 'png' */
  ext: string;
  mime: string;
  meta: ConvertMeta;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TraceOptions {
  mode: 'bw' | 'gray' | 'color';
  colors: number;
  detail: number;
  smoothing: number;
}
