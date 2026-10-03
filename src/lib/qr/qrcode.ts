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
      .catch((e) => {
        // 与其它引擎保持一致：失败时清空缓存，避免一次失败后永久失败，
        // 刷新页面 / 重试时能重新加载。
        cached = null;
        throw e instanceof ConvertError ? e : new ConvertError('二维码引擎加载失败，请刷新页面后重试');
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

/**
 * 各纠错等级下 byte 模式的**大致容量**（字符数），用于给出可行动的提示。
 * 实测边界（`probe-qr-capacity.cjs`，纯 ASCII）：L≈2950 / M≈2300 / Q≈1650 / H≈1250。
 * 中文等多字节字符会按字节计，实际能放的**字符数更少**，所以文案里写「约」。
 */
const CAPACITY: Record<QrOpts['level'], number> = { L: 2950, M: 2300, Q: 1650, H: 1250 };

/**
 * 把 qrcode 的异常翻译成中文。
 * ⚠️ 内容超容量时它抛的是**普通 Error**（`The amount of data is too big to be stored in a QR Code`），
 * 不匹配 `toUserMessage` 的任何规则 → 会被兜底成「处理失败…请尝试更换浏览器」，
 * 把「内容太长」说成了「浏览器不行」，用户会去换浏览器，永远修不好。
 */
async function withQrErrors<T>(opts: QrOpts, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConvertError) throw e;
    const msg = String((e as Error)?.message ?? '');
    if (/too big|too long|overflow|code length/i.test(msg)) {
      throw new ConvertError(
        `内容过长，超出二维码容量上限：纠错等级 ${opts.level} 最多约 ${CAPACITY[opts.level]} 个字符。` +
          `请缩短内容，或把纠错等级调低后重试。`,
      );
    }
    throw e; // 其余异常原样抛出，交给 toUserMessage 兜底 + console.error 留痕
  }
}

/** 把二维码画到给定 canvas 上（用于实时预览，避免 base64 往返） */
export async function qrToCanvas(canvas: HTMLCanvasElement, text: string, opts: QrOpts): Promise<void> {
  if (!text) throw new ConvertError('请输入要生成二维码的内容');
  const QR = await loadQr();
  await withQrErrors(opts, () => Promise.resolve(QR.toCanvas(canvas, text, libOptions(opts))));
  // qrcode 库会往 canvas 写入内联 style.width/height（如 320px），
  // 优先级高于预览区的响应式 CSS，会导致窄屏横向溢出。清掉内联样式，让布局交给 CSS。
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');
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
  return withQrErrors(opts, () => QR.toString(text, { ...libOptions(opts), type: 'svg' }));
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
