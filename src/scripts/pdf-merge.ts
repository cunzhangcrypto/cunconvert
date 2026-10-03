import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints } from './params';
import { mergePdfs } from '../lib/pdf/pdf-merge';

/** PDF 合并：多个 PDF 按列表顺序拼成一个 PDF，全部本地完成 */
export function mount(root: HTMLElement): void {
  initSegs(root);
  initRangeHints(root);

  initConvertTool(root, {
    sortable: true,
    async convertAll(files, _params, onProgress) {
      const blob = await mergePdfs(
        files.map((f) => ({ blob: f, name: f.name })),
        onProgress,
      );
      return { blob, name: 'merged.pdf' };
    },
    // PDF 无法在 <img> 中预览，使用占位块
    preview: () => '',
  });
}
