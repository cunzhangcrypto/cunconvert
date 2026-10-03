import { ConvertError } from '../utils/errors';
import { assertCanvasSize } from '../image/decode';
import { canvasToBlob, type EncodeType } from '../image/encode';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PdfToImageOpts {
  /** 要导出的页码（1-based） */
  pages: number[];
  format: EncodeType;
  quality: number;
  /** 渲染倍率：1 ≈ 72dpi，2 ≈ 144dpi，3 ≈ 216dpi */
  scale: number;
}

export interface PdfImageOutput {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

type PdfjsModule = typeof import('pdfjs-dist');

let cached: Promise<PdfjsModule> | null = null;

/** 按需加载 PDF.js，并把 worker 指向同源构建产物（不走 CDN） */
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!cached) {
    cached = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })().catch((e) => {
      cached = null;
      throw e instanceof ConvertError ? e : new ConvertError('PDF 渲染引擎加载失败，请刷新页面后重试');
    });
  }
  return cached;
}

/**
 * 打开 PDF，返回文档代理与释放函数。
 * 注意：pdfjs v6 的 `destroy()` 在 loading task 上，而不是文档代理上，
 * 因此这里把 task 一起带出去，统一用 destroy() 释放 worker 与资源。
 */
async function openDocument(blob: Blob): Promise<{ doc: PDFDocumentProxy; destroy: () => Promise<void> }> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    return { doc, destroy: () => task.destroy() };
  } catch (e) {
    await task.destroy().catch(() => undefined);
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') throw new ConvertError('该 PDF 已加密，需要密码才能打开');
    if (name === 'InvalidPDFException') throw new ConvertError('无法解析该 PDF，文件可能已损坏');
    throw new ConvertError('无法打开该 PDF 文件');
  }
}

/** 读取页数，用于渲染页面缩略图列表 */
export async function getPdfPageCount(blob: Blob): Promise<number> {
  const { doc, destroy } = await openDocument(blob);
  const count = doc.numPages;
  await destroy();
  return count;
}

export interface PdfThumb {
  page: number;
  url: string;
  width: number;
  height: number;
}

/**
 * 渲染每一页的小尺寸缩略图（dataURL），用于页面选择界面。
 * 统一输出 JPEG，避免几十页 PNG 占用过多内存。
 */
export async function renderPdfThumbnails(
  blob: Blob,
  targetWidth = 150,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfThumb[]> {
  const { doc, destroy } = await openDocument(blob);
  const out: PdfThumb[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.max(0.05, targetWidth / Math.max(1, base.width)));
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      await page.render({ canvas, viewport }).promise;
      page.cleanup();

      out.push({ page: i, url: canvas.toDataURL('image/jpeg', 0.72), width, height });
      onProgress?.(i, doc.numPages);
    }
  } finally {
    await destroy();
  }
  return out;
}

/** 把指定页渲染为图片（全部在浏览器本地完成） */
export async function pdfToImages(
  blob: Blob,
  opts: PdfToImageOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfImageOutput[]> {
  if (opts.pages.length === 0) throw new ConvertError('请至少选择一个页面');

  const { doc, destroy } = await openDocument(blob);
  const out: PdfImageOutput[] = [];
  const total = opts.pages.length;

  try {
    for (let i = 0; i < total; i++) {
      const pageNo = opts.pages[i];
      if (pageNo < 1 || pageNo > doc.numPages) continue;

      const page = await doc.getPage(pageNo);
      const viewport = page.getViewport({ scale: opts.scale });
      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));
      assertCanvasSize(width, height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
      // JPG 不支持透明，先铺白底
      if (opts.format === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      await page.render({ canvas, viewport }).promise;
      page.cleanup();

      const outBlob = await canvasToBlob(
        canvas,
        opts.format,
        opts.format === 'png' ? undefined : opts.quality,
      );
      out.push({
        name: `page-${String(pageNo).padStart(3, '0')}.${opts.format}`,
        blob: outBlob,
        width,
        height,
      });

      onProgress?.(i + 1, total);
    }
  } finally {
    await destroy();
  }

  if (out.length === 0) throw new ConvertError('没有可导出的页面');
  return out;
}
