import { initConvertTool, type ConvertOutput } from './convert-ui';
import { initSegs, bindSeg, num } from './params';
import { resizeImage } from '../lib/converters/resize';
import { replaceExt } from '../lib/utils/file';

/** 调整图片尺寸：像素 / 百分比 / 平台预设（可一次输出多张） */
export function mount(root: HTMLElement): void {
  initSegs(root);

  const widthField = root.querySelector<HTMLInputElement>('input[data-param="width"]');
  const heightField = root.querySelector<HTMLInputElement>('input[data-param="height"]');
  const lockField = root.querySelector<HTMLInputElement>('input[data-param="lock"]');
  const percentField = root.querySelector<HTMLInputElement>('input[data-param="percent"]');
  const quickField = root.querySelector<HTMLSelectElement>('select[data-param="quick"]');
  const lockRow = root.querySelector<HTMLElement>('[data-lock-label]');

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
      const mode = (p['resize-mode'] as 'px' | 'percent' | 'quick') ?? 'px';
      const q = String(p.quick ?? '');

      // 平台预设一次输出多张：value 形如 "1920x1080:cover|1440x1080:blur"
      if (mode === 'quick' && q.includes('|')) {
        const base = file.name.replace(/\.[^.]+$/, '');
        const outs: ConvertOutput[] = [];
        for (const spec of q.split('|')) {
          const m = spec.trim().match(/^(\d+)\s*[x×]\s*(\d+)(?::(stretch|cover|blur))?$/i);
          if (!m) continue;
          const w = Number(m[1]);
          const h = Number(m[2]);
          const res = await resizeImage(file, { mode: 'quick', quick: spec.trim() });
          outs.push({
            blob: res.blob,
            name: `${base}_${w}x${h}.${res.ext}`,
            width: res.meta.width,
            height: res.meta.height,
            savedPercent: res.meta.savedPercent,
          });
        }
        if (outs.length > 0) return outs;
      }

      const res = await resizeImage(file, {
        mode,
        width: num(p.width),
        height: num(p.height),
        lockRatio: !!p.lock,
        percent: num(p.percent),
        quick: q,
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
