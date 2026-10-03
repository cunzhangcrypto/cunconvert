import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints, num } from './params';
import { imagesToPdf, type PdfOrientation, type PdfPageSize } from '../lib/pdf/image-to-pdf';

/** 图片 → PDF：多张图片按列表顺序合成一个多页 PDF */
export function mount(root: HTMLElement): void {
  initSegs(root);
  initRangeHints(root);

  initConvertTool(root, {
    sortable: true,
    async convertAll(files, p, onProgress) {
      const blob = await imagesToPdf(
        files.map((f) => ({ blob: f, name: f.name })),
        {
          pageSize: (p['page-size'] as PdfPageSize) ?? 'a4',
          orientation: (p['orientation'] as PdfOrientation) ?? 'portrait',
          margin: num(p.margin) ?? 0,
        },
        onProgress,
      );
      return { blob, name: 'images.pdf' };
    },
    // PDF 无法在 <img> 中预览，使用占位图标
    preview: () => '',
  });
}
