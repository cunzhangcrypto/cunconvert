import { ConvertError } from '../utils/errors';
import { decodeToImage } from '../image/decode';
import { loadPdfLib } from './pdflib';

/** A4 尺寸（pt，1pt = 1/72 英寸） */
const A4 = { w: 595.28, h: 841.89 };
/** 位图按 96dpi 换算到 pt 的系数 */
const PX_TO_PT = 72 / 96;
/** 嗅探格式时只读文件头这么多字节 */
const HEAD_LEN = 1024;

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

type ImageKind = 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'svg' | 'unknown';

interface Embeddable {
  bytes: Uint8Array;
  kind: 'png' | 'jpg';
  width: number;
  height: number;
}

/**
 * ⚠️ 从**文件头**判断真实格式。
 *
 * 不要相信 `blob.type` —— 它是浏览器根据**扩展名**推出来的，文件名后缀与真实内容
 * 不一致时（微信/QQ 另存、批量改名、下载时被改后缀、截图工具写错扩展名）会指向
 * 错误的嵌入器：JPEG 字节交给 `embedPng` 会抛 `Invalid PNG signature`，
 * PNG 字节交给 `embedJpg` 会抛 `SOI not found in JPEG`。
 * pdf-lib 抛的是普通 Error，会被兜底文案吞掉，用户只看到「请更换浏览器」。
 */
async function sniffKind(blob: Blob): Promise<ImageKind> {
  const head = new Uint8Array(await blob.slice(0, HEAD_LEN).arrayBuffer());

  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
    return 'png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  // RIFF....WEBP
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  )
    return 'webp';
  if (head.length >= 3 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return 'gif';
  if (head.length >= 2 && head[0] === 0x42 && head[1] === 0x4d) return 'bmp';

  // SVG 是文本，前面可能有 BOM / 空白 / XML 声明 / 注释
  const text = new TextDecoder('utf-8', { fatal: false }).decode(head).trimStart();
  if (/^<(\?xml|!--|svg)/i.test(text)) return 'svg';

  return 'unknown';
}

/**
 * 经 Canvas 光栅化为 PNG。
 * 用于 pdf-lib 不支持的编码（WebP / GIF / BMP / SVG），
 * 以及嵌入失败时的兜底重编码。
 */
async function rasterizeToPng(blob: Blob): Promise<Embeddable> {
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

/**
 * 把任意浏览器可解码的图片转成 PDF 能嵌入的数据。
 * pdf-lib 只支持 PNG / JPEG：这两种直接透传原始字节（不重编码，画质无损、体积最小），
 * 其余格式先经 Canvas 光栅化成 PNG。
 */
async function toEmbeddable(blob: Blob): Promise<Embeddable> {
  const kind = await sniffKind(blob);

  if (kind === 'png' || kind === 'jpg') {
    const img = await decodeToImage(blob);
    if (!img.naturalWidth || !img.naturalHeight) throw new ConvertError('无法读取图片尺寸');
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      kind,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  return rasterizeToPng(blob);
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
    const item = items[i];
    const emb = await toEmbeddable(item.blob);

    let image;
    try {
      image = emb.kind === 'png' ? await pdf.embedPng(emb.bytes) : await pdf.embedJpg(emb.bytes);
    } catch (e) {
      // 兜底：文件头认得、但 pdf-lib 仍然拒绝（罕见编码 / 头部损坏）。
      // 重编码成 PNG 再嵌，同时把原始错误打出来，别让它被兜底文案吞掉。
      console.warn('[cunconvert] pdf-lib 嵌入失败，改用 Canvas 重编码：', item.name, e);
      const png = await rasterizeToPng(item.blob);
      try {
        image = await pdf.embedPng(png.bytes);
      } catch {
        throw new ConvertError(`无法把「${item.name}」加入 PDF，图片可能已损坏`);
      }
    }

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
