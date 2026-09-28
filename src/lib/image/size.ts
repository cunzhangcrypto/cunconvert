/** 目标尺寸计算：主线程与 Worker 共用同一套规则 */

export interface SizeOpts {
  width?: number;
  height?: number;
  scale?: number;
  lockRatio?: boolean;
}

export function computeTargetSize(
  srcW: number,
  srcH: number,
  opts: SizeOpts,
): { width: number; height: number } {
  let w = srcW;
  let h = srcH;

  if (opts.scale && opts.scale > 0) {
    w = Math.round(srcW * opts.scale);
    h = Math.round(srcH * opts.scale);
  }

  if (opts.width && opts.width > 0) {
    if (opts.height && opts.height > 0 && !opts.lockRatio) {
      w = opts.width;
      h = opts.height;
    } else {
      w = opts.width;
      h = Math.max(1, Math.round(opts.width * (srcH / srcW)));
    }
  } else if (opts.height && opts.height > 0) {
    h = opts.height;
    w = Math.max(1, Math.round(opts.height * (srcW / srcH)));
  }

  if (w < 1) w = 1;
  if (h < 1) h = 1;
  return { width: w, height: h };
}
