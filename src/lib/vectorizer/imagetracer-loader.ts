import { ConvertError } from '../utils/errors';

declare global {
  interface Window {
    ImageTracer?: {
      imagedataToSVG: (data: ImageData, options?: Record<string, unknown>) => string;
    };
  }
}

let cached: Promise<Window['ImageTracer']> | null = null;

/**
 * 按需加载矢量化引擎 imagetracerjs（UMD，放 public/vendor 下）。
 * 仅矢量化页面会触发加载。
 */
export function loadImageTracer(): Promise<NonNullable<Window['ImageTracer']>> {
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      if (window.ImageTracer) {
        resolve(window.ImageTracer);
        return;
      }
      const s = document.createElement('script');
      s.src = '/vendor/imagetracer_v1.2.6.js';
      s.async = true;
      s.onload = () => {
        if (window.ImageTracer) resolve(window.ImageTracer);
        else reject(new ConvertError('矢量化引擎加载失败'));
      };
      s.onerror = () => reject(new ConvertError('矢量化引擎加载失败，请检查网络后重试'));
      document.head.appendChild(s);
    });
  }
  return cached as Promise<NonNullable<Window['ImageTracer']>>;
}

/** 根据黑白/灰度/彩色模式与参数生成 ImageTracer 配置 */
export function buildTracerOptions(opts: {
  mode: 'bw' | 'gray' | 'color';
  colors: number;
  detail: number;
  smoothing: number;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (opts.mode === 'bw') {
    base.colorsampling = 0;
    base.numberofcolors = 2;
    base.mincolorratio = 0;
    base.pathomit = 4;
  } else if (opts.mode === 'gray') {
    base.colorsampling = 0;
    base.numberofcolors = 8;
    base.mincolorratio = 0;
  } else {
    base.colorsampling = 2;
    base.numberofcolors = Math.max(2, Math.min(32, Math.round(opts.colors)));
    base.mincolorratio = 0.02;
    base.colorquantcycles = 3;
  }
  // detail 0-100 -> pathomit 12-4（数值越大丢弃的小路径越多，输出越干净）
  base.pathomit = base.pathomit ?? Math.max(2, Math.min(12, Math.round(12 - (opts.detail / 100) * 8)));
  // 路径平滑度：ltres/qtres 越大轮廓越平滑（折线感越弱），细节相应减少
  base.ltres = 0.9 + (opts.detail / 100) * 1.3;
  base.qtres = 0.7 + (opts.detail / 100) * 1.5;
  // 预模糊：摊平渐变阴影、滤除噪点，避免碎块；平滑越高越整体
  base.blurradius = 2 + (opts.smoothing / 100) * 8;
  base.blurdelta = 2 + (opts.smoothing / 100) * 8;
  return base;
}
