import { ConvertError } from '../utils/errors';
import { decodeToImage } from '../image/decode';
import { loadPdfLib } from './pdflib';

/** A4 尺寸（pt，1pt = 1/72 英寸） */
const A4 = { w: 595.28, h: 841.89 };
/** 位图按 96dpi 换算到 pt 的系数 */
const PX_TO_PT = 72 / 96;

export type PdfPageSize = 'a4' | 'fit';
export type PdfOrientation = 'portrait' | 'landscape';

export interface ImageToPdfOpts {
  /** a4 = 固定 A4；fit = 跟随原图尺寸 */
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  /** 页边距，单位 pt */
  margin: number;
}

export interface PdfImageItem {
  blob: Blob;
  name: string;
}

interface Embeddable {
  bytes: Uint8Array;
  kind: 'png' | 'jpg';
  width: number;
  height: number;
}

/**
 * 把任意浏览器可解码的图片转成 PDF 能嵌入的数据。
 * pdf-lib 只支持 PNG / JPEG，WebP、SVG 等先经 Canvas 光栅化成 PNG。
 */
async function toEmbeddable(blob: Blob): Promise<Embeddable> {
  const type = (blob.type || '').toLowerCase();
  if (type === 'image/png' || type === 'image/jpeg') {
    const img = await decodeToImage(blob);
    if (!img.naturalWidth || !img.naturalHeight) throw new ConvertError('无法读取图片尺寸');
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      kind: type === 'image/png' ? 'png' : 'jpg',
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  // WebP / SVG / 其他：光栅化为 PNG（顺带抹掉 PDF 不支持的编码）
  const img = await decodeToImage(blob);
  const w = img.naturalWidth || 0;
  const h = img.naturalHeight || 0;
  if (!w || !h) throw new ConvertError('无法读取图片尺寸，SVG 可能缺少 width/height 或 viewBox');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('无法创建绘图上下文，请更换较新的浏览器');
  ctx.drawImage(img, 0, 0);

  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new ConvertError('图片编码失败，请尝试其他格式');
  return { bytes: new Uint8Array(await png.arrayBuffer()), kind: 'png', width: w, height: h };
}

/** 多张图片按顺序合并为一个多页 PDF（全部在浏览器本地完成） */
export async function imagesToPdf(
  items: PdfImageItem[],
  opts: ImageToPdfOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (items.length === 0) throw new ConvertError('请先选择要转换的图片');

  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  pdf.setProducer('CunConvert');
  pdf.setCreator('CunConvert');

  for (let i = 0; i < items.length; i++) {
    const emb = await toEmbeddable(items[i].blob);
    const image = emb.kind === 'png' ? await pdf.embedPng(emb.bytes) : await pdf.embedJpg(emb.bytes);

    let pageW: number;
    let pageH: number;
    if (opts.pageSize === 'a4') {
      pageW = opts.orientation === 'landscape' ? A4.h : A4.w;
      pageH = opts.orientation === 'landscape' ? A4.w : A4.h;
    } else {
      pageW = emb.width * PX_TO_PT;
      pageH = emb.height * PX_TO_PT;
    }

    const page = pdf.addPage([pageW, pageH]);

    // 边距不能超过页面短边的一半，留 1pt 余量
    const margin = Math.max(0, Math.min(opts.margin, Math.min(pageW, pageH) / 2 - 1));
    const availW = Math.max(1, pageW - margin * 2);
    const availH = Math.max(1, pageH - margin * 2);
    const scale = Math.min(availW / emb.width, availH / emb.height);
    const drawW = emb.width * scale;
    const drawH = emb.height * scale;

    page.drawImage(image, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });

    onProgress?.(i + 1, items.length);
  }

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
