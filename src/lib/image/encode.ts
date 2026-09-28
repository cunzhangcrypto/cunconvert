import { ConvertError } from '../utils/errors';

export type EncodeType = 'png' | 'jpg' | 'webp';

export const MIME: Record<EncodeType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** 探测当前浏览器是否支持某种输出格式的编码 */
export function probeCanvas(type: EncodeType): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c.toDataURL(MIME[type]).startsWith(`data:${MIME[type]}`);
  } catch {
    return false;
  }
}

/** 将画布编码为指定格式的 Blob，优先使用 OffscreenCanvas.convertToBlob，失败回退 toBlob */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: EncodeType,
  quality?: number,
): Promise<Blob> {
  const mime = MIME[type];

  if (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  ) {
    try {
      const off = new OffscreenCanvas(canvas.width, canvas.height);
      const octx = off.getContext('2d');
      if (octx) {
        octx.drawImage(canvas, 0, 0);
        const blob = await off.convertToBlob({ type: mime, quality });
        if (blob) return blob;
      }
    } catch {
      // 回退 toBlob
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) {
    throw new ConvertError('图片编码失败，当前浏览器可能不支持输出该格式，请尝试其他输出格式');
  }
  return blob;
}
