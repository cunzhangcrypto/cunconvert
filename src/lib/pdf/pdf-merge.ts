import { ConvertError } from '../utils/errors';
import { loadPdfLib, describeLoadError } from './pdflib';

/**
 * 把多个 PDF 按给定顺序拼接成一个 PDF（全部在浏览器本地完成）。
 * 页序 = 传入数组的顺序，由调用方通过列表排序决定。
 */
export async function mergePdfs(
  items: { blob: Blob; name: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (items.length < 2) throw new ConvertError('请至少选择 2 个 PDF 文件进行合并');

  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  out.setProducer('CunConvert');
  out.setCreator('CunConvert');

  for (let i = 0; i < items.length; i++) {
    const bytes = new Uint8Array(await items[i].blob.arrayBuffer());
    let src;
    try {
      src = await PDFDocument.load(bytes);
    } catch (e) {
      throw describeLoadError(items[i].name, e);
    }
    if (src.getPageCount() === 0) throw new ConvertError(`「${items[i].name}」没有可合并的页面`);

    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
    onProgress?.(i + 1, items.length);
  }

  const data = await out.save();
  return new Blob([data as BlobPart], { type: 'application/pdf' });
}
