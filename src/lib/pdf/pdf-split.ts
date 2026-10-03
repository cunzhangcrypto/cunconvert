import { ConvertError } from '../utils/errors';
import { loadPdfLib, describeLoadError } from './pdflib';

export type SplitMode = 'each' | 'range' | 'chunk';

export interface SplitOpts {
  /** each = 每页一个文件；range = 按选中页逐个拆出；chunk = 每 N 页一组 */
  mode: SplitMode;
  /** mode = 'range' 时要拆出的页码（1-based） */
  pages: number[];
  /** mode = 'chunk' 时每组页数 */
  chunkSize: number;
}

export interface SplitOutput {
  name: string;
  blob: Blob;
}

/** 把拆分方案展开成「每组包含哪些页码」 */
function buildGroups(opts: SplitOpts, total: number): number[][] {
  if (opts.mode === 'each') {
    return Array.from({ length: total }, (_, i) => [i + 1]);
  }

  if (opts.mode === 'range') {
    const valid = [...new Set(opts.pages)]
      .filter((p) => Number.isInteger(p) && p >= 1 && p <= total)
      .sort((a, b) => a - b);
    if (valid.length === 0) throw new ConvertError('请至少选择一个要拆分的页面');
    return valid.map((p) => [p]);
  }

  const size = Math.max(1, Math.floor(opts.chunkSize) || 1);
  const groups: number[][] = [];
  for (let start = 1; start <= total; start += size) {
    const g: number[] = [];
    for (let p = start; p < start + size && p <= total; p++) g.push(p);
    groups.push(g);
  }
  return groups;
}

/** 按指定方案把一个 PDF 拆成多份（全部在浏览器本地完成） */
export async function splitPdf(
  blob: Blob,
  name: string,
  opts: SplitOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<SplitOutput[]> {
  const { PDFDocument } = await loadPdfLib();

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let src;
  try {
    src = await PDFDocument.load(bytes);
  } catch (e) {
    throw describeLoadError(name, e);
  }

  const total = src.getPageCount();
  if (total === 0) throw new ConvertError('该 PDF 没有可拆分的页面');

  const groups = buildGroups(opts, total);
  const pad = String(groups.length).length;
  const base = name.replace(/\.pdf$/i, '') || 'document';
  const out: SplitOutput[] = [];

  for (let i = 0; i < groups.length; i++) {
    const doc = await PDFDocument.create();
    doc.setProducer('CunConvert');
    doc.setCreator('CunConvert');
    const pages = await doc.copyPages(
      src,
      groups[i].map((p) => p - 1),
    );
    for (const page of pages) doc.addPage(page);

    const data = await doc.save();
    const label = String(i + 1).padStart(pad, '0');
    const suffix =
      opts.mode === 'range'
        ? `p${String(groups[i][0]).padStart(String(total).length, '0')}`
        : `part-${label}`;

    out.push({
      name: `${base}-${suffix}.pdf`,
      blob: new Blob([data as BlobPart], { type: 'application/pdf' }),
    });
    onProgress?.(i + 1, groups.length);
  }

  return out;
}
