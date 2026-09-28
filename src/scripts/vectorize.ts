import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints, num } from './params';
import { vectorizeImage } from '../lib/converters/vectorize';
import { replaceExt } from '../lib/utils/file';

/** 图片矢量化：PNG / JPG / WebP -> SVG */
export function mount(root: HTMLElement): void {
  initSegs(root);
  initRangeHints(root);

  initConvertTool(root, {
    async convert(file, p) {
      const res = await vectorizeImage(file, {
        mode: (p.mode as 'bw' | 'gray' | 'color') ?? 'color',
        colors: num(p.colors) ?? 8,
        detail: num(p.detail) ?? 50,
        smoothing: num(p.smoothing) ?? 50,
      });
      return {
        blob: res.blob,
        name: replaceExt(file.name, 'svg'),
        width: res.meta.width,
        height: res.meta.height,
        savedPercent: res.meta.savedPercent,
      };
    },
    preview: (blob) => URL.createObjectURL(blob),
  });
}
