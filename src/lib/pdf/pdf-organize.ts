import { ConvertError } from '../utils/errors';
import { loadPdfLib, describeLoadError } from './pdflib';

export interface PageOp {
  /** 源文档中的页码（1-based） */
  source: number;
  /** 在原始页面旋转基础上追加的角度：0 / 90 / 180 / 270 */
  rotation: number;
}

/**
 * 按给定的页面顺序与旋转角度重建 PDF（删除 = 不放进 ops）。
 * 旋转是「追加」语义：会叠加页面原本就带的 /Rotate，不会把它覆盖掉。
 */
export async function organizePdf(
  blob: Blob,
  name: string,
  ops: PageOp[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (ops.length === 0) throw new ConvertError('请至少保留一个页面');

  const { PDFDocument, degrees } = await loadPdfLib();

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let src;
  try {
    src = await PDFDocument.load(bytes);
  } catch (e) {
    throw describeLoadError(name, e);
  }

  const total = src.getPageCount();
  for (const op of ops) {
    if (!Number.isInteger(op.source) || op.source < 1 || op.source > total) {
      throw new ConvertError('页面信息无效，请重新上传 PDF 后再试');
    }
  }

  const out = await PDFDocument.create();
  out.setProducer('CunConvert');
  out.setCreator('CunConvert');

  // 一页只出现一次（本工具不做复制页），因此可以一次性批量复制
  const copied = await out.copyPages(
    src,
    ops.map((o) => o.source - 1),
  );

  for (let i = 0; i < copied.length; i++) {
    const page = copied[i];
    const delta = (((ops[i].rotation % 360) + 360) % 360) as number;
    if (delta !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((((current + delta) % 360) + 360) % 360));
    }
    out.addPage(page);
    onProgress?.(i + 1, ops.length);
  }

  const data = await out.save();
  return new Blob([data as BlobPart], { type: 'application/pdf' });
}
