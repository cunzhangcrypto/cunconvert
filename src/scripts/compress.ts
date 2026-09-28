import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints, bindSeg, num } from './params';
import { compressImage } from '../lib/converters/compress';
import { replaceExt } from '../lib/utils/file';

/** 图片压缩：质量 + 输出格式 + 可选百分比缩放 */
export function mount(root: HTMLElement): void {
  initSegs(root);
  initRangeHints(root);

  // 百分比缩放控件显隐
  const percentField = root.querySelector<HTMLInputElement>('input[data-param="percent"]');
  bindSeg(root, 'resize-mode', (v) => {
    const row = percentField?.closest<HTMLElement>('.input-row');
    if (row) row.style.display = v === 'percent' ? '' : 'none';
  });

  initConvertTool(root, {
    async convert(file, p) {
      const res = await compressImage(file, {
        format: (p.format as 'jpg' | 'png' | 'webp') ?? 'webp',
        quality: num(p.quality) ?? 80,
        scale: p['resize-mode'] === 'percent' ? num(p.percent) ?? 50 : undefined,
      });
      return {
        blob: res.blob,
        name: replaceExt(file.name, res.ext),
        width: res.meta.width,
        height: res.meta.height,
        savedPercent: res.meta.savedPercent,
      };
    },
  });
}
