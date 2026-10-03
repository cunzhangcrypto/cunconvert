import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints, initColorRows, num, resolveBackgroundParam } from './params';
import { convertRaster } from '../lib/converters/format';
import { replaceExt } from '../lib/utils/file';

const SLUG_OUT: Record<string, 'png' | 'jpg' | 'webp'> = {
  'png-to-jpg': 'jpg',
  'png-to-webp': 'webp',
  'jpg-to-png': 'png',
  'jpg-to-webp': 'webp',
  'webp-to-png': 'png',
  'webp-to-jpg': 'jpg',
};

/** 六种位图格式互转（PNG/JPG/WebP 两两转换） */
export function mount(root: HTMLElement): void {
  const outputType = SLUG_OUT[root.dataset.tool ?? ''] ?? 'png';
  const allowTransparent = outputType !== 'jpg';
  initSegs(root);
  initRangeHints(root);
  initColorRows(root);

  initConvertTool(root, {
    async convert(file, p) {
      const res = await convertRaster(file, {
        outputType,
        quality: num(p.quality) ?? 90,
        background: resolveBackgroundParam(p, allowTransparent),
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
