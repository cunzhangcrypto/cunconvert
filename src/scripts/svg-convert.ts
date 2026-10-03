import { initConvertTool } from './convert-ui';
import { initSegs, initSizeFields, initRangeHints, initColorRows, num, resolveBackgroundParam } from './params';
import { svgToBitmap } from '../lib/converters/svg-to-bitmap';
import { replaceExt } from '../lib/utils/file';

const SLUG_OUT: Record<string, 'png' | 'jpg' | 'webp'> = {
  'svg-to-png': 'png',
  'svg-to-jpg': 'jpg',
  'svg-to-webp': 'webp',
};

/** SVG → PNG / JPG / WebP */
export function mount(root: HTMLElement): void {
  const outputType = SLUG_OUT[root.dataset.tool ?? ''] ?? 'png';
  const allowTransparent = outputType !== 'jpg';
  initSegs(root);
  initSizeFields(root);
  initRangeHints(root);
  initColorRows(root);

  initConvertTool(root, {
    async convert(file, p) {
      const sizeMode = p['size-mode'];
      const res = await svgToBitmap(file, {
        outputType,
        quality: num(p.quality) ?? 90,
        scale: num(p.scale),
        width: sizeMode === 'custom' ? num(p.width) : undefined,
        height: sizeMode === 'custom' ? num(p.height) : undefined,
        lockRatio: !!p.lock,
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
