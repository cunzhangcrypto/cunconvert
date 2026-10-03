import { ConvertError } from '../utils/errors';
import { decodeToImage, MAX_CANVAS_AREA } from '../image/decode';
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

  // ⚠️ 这里**只查面积**，不用 assertCanvasSize()。
  // 画布的真实上限是「总面积」而不是单边（Chrome: 单边 65535、总面积 268M 像素）；
  // 实测 20000×100 这种「很宽很扁」的图（面积仅 2MP）能正常画出 PDF，
  // 而 assertCanvasSize 连单边 > 16384 也拒 —— 用了会把本来能用的图误拒。
  // 面积超限时浏览器分配不出画布，toBlob 返回 null，只会得到「图片编码失败」这种
  // 指错方向的提示，所以必须在这里先给出准确的尺寸错误。
  if (w * h > MAX_CANVAS_AREA) {
    throw new ConvertError(`图片尺寸过大（${w} × ${h}），浏览器无法分配画布，请先缩小后再试`);
  }

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

/** 解析 EXIF 方向用的扫描字节数（EXIF APP1 通常紧跟在 SOI 之后） */
const EXIF_SCAN_LEN = 65536;

/** 从 TIFF 头里读取 Orientation（0x0112） */
function readExifOrientation(b: Uint8Array, start: number, end: number): number {
  if (start + 8 > b.length) return 1;
  const little = b[start] === 0x49 && b[start + 1] === 0x49;
  const big = b[start] === 0x4d && b[start + 1] === 0x4d;
  if (!little && !big) return 1;
  const u16 = (p: number): number => (little ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
  const u32 = (p: number): number =>
    little
      ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0
      : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
  if (u16(start + 2) !== 0x002a) return 1;
  const ifd0 = start + u32(start + 4);
  if (ifd0 + 2 > b.length || ifd0 >= end) return 1;
  const count = u16(ifd0);
  for (let k = 0; k < count; k++) {
    const entry = ifd0 + 2 + k * 12;
    if (entry + 12 > b.length || entry + 12 > end) break;
    if (u16(entry) === 0x0112) {
      const val = u16(entry + 8);
      return val >= 1 && val <= 8 ? val : 1;
    }
  }
  return 1;
}

/**
 * 读取 JPEG 的 EXIF Orientation（1-8）。无 EXIF 或解析失败时返回 1（正常方向）。
 * 手机竖拍照片常带 Orientation=6/8，pdf-lib 透传原始字节时不会应用该方向，
 * 会导致图片在 PDF 里躺倒，因此需要先探测出来再决定是否光栅化。
 */
function readJpegOrientation(b: Uint8Array): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // 无长度字段的标记（SOI / TEM / RSTn）
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // SOS 之后是压缩数据，不再有元数据
    if (marker === 0xda) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) break;
    if (
      marker === 0xe1 &&
      i + 10 <= b.length &&
      b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66 &&
      b[i + 8] === 0x00 && b[i + 9] === 0x00
    ) {
      return readExifOrientation(b, i + 10, i + 2 + len);
    }
    i += 2 + len;
  }
  return 1;
}

/**
 * 把任意浏览器可解码的图片转成 PDF 能嵌入的数据。
 * pdf-lib 只支持 PNG / JPEG：这两种直接透传原始字节（不重编码，画质无损、体积最小），
 * 其余格式先经 Canvas 光栅化成 PNG。
 *
 * 例外：带 EXIF 方向（Orientation ≠ 1）的 JPEG 必须光栅化 —— pdf-lib 透传原始字节时
 * 不会应用 EXIF 旋转，嵌进 PDF 后会与用户在上传列表里看到的方向不一致（常见于手机照片）。
 * Canvas 的 drawImage 会应用 EXIF 方向，因此重新编码成 PNG 才能得到正确的朝向。
 */
async function toEmbeddable(blob: Blob): Promise<Embeddable> {
  const kind = await sniffKind(blob);

  if (kind === 'png' || kind === 'jpg') {
    if (kind === 'jpg') {
      const head = new Uint8Array(await blob.slice(0, EXIF_SCAN_LEN).arrayBuffer());
      if (readJpegOrientation(head) !== 1) return rasterizeToPng(blob);
    }
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
