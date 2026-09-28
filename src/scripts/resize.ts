import { initConvertTool } from './convert-ui';
import { initSegs, bindSeg, num } from './params';
import { resizeImage } from '../lib/converters/resize';
import { replaceExt } from '../lib/utils/file';

/** 调整图片尺寸：像素 / 百分比 / 快捷尺寸 */
export function mount(root: HTMLElement): void {
  initSegs(root);

  const widthField = root.querySelector<HTMLInputElement>('input[data-param="width"]');
  const heightField = root.querySelector<HTMLInputElement>('input[data-param="height"]');
  const lockField = root.querySelector<HTMLInputElement>('input[data-param="lock"]');
  const percentField = root.querySelector<HTMLInputElement>('input[data-param="percent"]');
  const quickField = root.querySelector<HTMLSelectElement>('select[data-param="quick"]');
  const lockRow = lockField?.closest<HTMLElement>('.input-row');

  const show = (el: HTMLElement | null | undefined, visible: boolean) => {
    if (el) el.style.display = visible ? '' : 'none';
  };

  bindSeg(root, 'resize-mode', (v) => {
    show(widthField, v === 'px');
    show(heightField, v === 'px');
    show(percentField, v === 'percent');
    show(quickField, v === 'quick');
    show(lockRow, v === 'px');
  });

  initConvertTool(root, {
    async convert(file, p) {
      const res = await resizeImage(file, {
        mode: (p['resize-mode'] as 'px' | 'percent' | 'quick') ?? 'px',
        width: num(p.width),
        height: num(p.height),
        lockRatio: !!p.lock,
        percent: num(p.percent),
        quick: num(p.quick),
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
