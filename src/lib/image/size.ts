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

  if (opts.width && opts.width > 0 && opts.height && opts.height > 0) {
    // 同时指定宽高：以用户输入为准（锁定比例不再覆盖显式输入）
    w = opts.width;
    h = opts.height;
  } else if (opts.width && opts.width > 0) {
    w = opts.width;
    if (opts.lockRatio !== false) h = Math.max(1, Math.round(opts.width * (srcH / srcW)));
  } else if (opts.height && opts.height > 0) {
    h = opts.height;
    if (opts.lockRatio !== false) w = Math.max(1, Math.round(opts.height * (srcW / srcH)));
  }

  if (w < 1) w = 1;
  if (h < 1) h = 1;
  return { width: w, height: h };
}
