import { initConvertTool } from './convert-ui';
import { initSegs, num } from './params';
import { rotateFlipImage } from '../lib/converters/rotate-flip';
import { replaceExt } from '../lib/utils/file';

/** 旋转与翻转 */
export function mount(root: HTMLElement): void {
  initSegs(root);

  initConvertTool(root, {
    async convert(file, p) {
      const res = await rotateFlipImage(file, {
        rotate: (num(p.rotate) ?? 0) as 0 | 90 | 180 | 270,
        flipH: !!p.flipH,
        flipV: !!p.flipV,
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
