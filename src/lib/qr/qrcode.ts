import { ConvertError } from '../utils/errors';

export interface QrOpts {
  /** 输出像素尺寸（正方形边长） */
  size: number;
  /** 静默边距（模块数，0-8） */
  margin: number;
  /** 前景色 */
  dark: string;
  /** 背景色 */
  light: string;
  /** 纠错等级：L 7% / M 15% / Q 25% / H 30% */
  level: 'L' | 'M' | 'Q' | 'H';
}

export const QR_DEFAULTS: QrOpts = {
  size: 512,
  margin: 2,
  dark: '#0a0a0a',
  light: '#ffffff',
  level: 'M',
};

type QrLib = {
  toCanvas: (canvas: HTMLCanvasElement, text: string, opts?: unknown) => Promise<unknown>;
  toString: (text: string, opts?: unknown) => Promise<string>;
};

let cached: Promise<QrLib> | null = null;

/** 按需加载二维码引擎（仅二维码页面用到），内容不出浏览器 */
async function loadQr(): Promise<QrLib> {
  if (!cached) {
    cached = import('qrcode')
      .then((m) => ((m as { default?: QrLib }).default ?? (m as unknown as QrLib)))
      .catch(() => {
        throw new ConvertError('二维码引擎加载失败，请刷新页面后重试');
      });
  }
  return cached;
}

function libOptions(opts: QrOpts): Record<string, unknown> {
  return {
    width: opts.size,
    margin: opts.margin,
    errorCorrectionLevel: opts.level,
    color: { dark: opts.dark, light: opts.light },
  };
}

/** 把二维码画到给定 canvas 上（用于实时预览，避免 base64 往返） */
export async function qrToCanvas(canvas: HTMLCanvasElement, text: string, opts: QrOpts): Promise<void> {
  if (!text) throw new ConvertError('请输入要生成二维码的内容');
  const QR = await loadQr();
  await QR.toCanvas(canvas, text, libOptions(opts));
}

/** 生成 PNG Blob */
export async function qrToPngBlob(text: string, opts: QrOpts): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await qrToCanvas(canvas, text, opts);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new ConvertError('二维码生成失败');
  return blob;
}

/** 生成 SVG 文本（矢量，可无损放大） */
export async function qrToSvg(text: string, opts: QrOpts): Promise<string> {
  if (!text) throw new ConvertError('请输入要生成二维码的内容');
  const QR = await loadQr();
  return QR.toString(text, { ...libOptions(opts), type: 'svg' });
}

/**
 * 预览专用尺寸。
 * 预览区宽度有限（约 286px），若按用户选的 1024 去渲染，
 * 画布既浪费内存、又会因为 CSS 缩放与 canvas 像素尺寸不一致而显示变形。
 * 所以实时预览固定按这个尺寸渲染，导出时才使用用户选择的尺寸。
 */
export const QR_PREVIEW_SIZE = 320;

export interface QrBatchItem {
  name: string;
  blob: Blob;
}

/**
 * 批量生成：每个非空行生成一个二维码 PNG。
 * 全部在浏览器本地完成，内容不出设备。
 */
export async function qrBatchToPngBlobs(
  texts: string[],
  opts: QrOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<QrBatchItem[]> {
  const list = texts.map((t) => t.trim()).filter(Boolean);
  if (list.length === 0) throw new ConvertError('请输入要生成二维码的内容，每行一条');

  const out: QrBatchItem[] = [];
  const pad = String(list.length).length;

  for (let i = 0; i < list.length; i++) {
    const blob = await qrToPngBlob(list[i], opts);
    out.push({ name: `qr-${String(i + 1).padStart(pad, '0')}.png`, blob });
    onProgress?.(i + 1, list.length);
  }
  return out;
}
