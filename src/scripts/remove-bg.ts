import { initConvertTool } from './convert-ui';
import { initSegs, initRangeHints, initColorRows, num, type Params } from './params';
import { removeBg, removeBgName } from '../lib/converters/remove-bg';

/** 去背景：选择背景色 -> 变透明 PNG，全部本地处理 */
export function mount(root: HTMLElement): void {
  initSegs(root);
  initRangeHints(root);
  initColorRows(root);

  initConvertTool(root, {
    async convert(file, p: Params) {
      const segColor = p['bg-color'];
      let color = '#ffffff';
      if (typeof segColor === 'string' && segColor !== 'custom') color = segColor;
      else if (segColor === 'custom') {
        const c = p['bg-color-custom'];
        color = typeof c === 'string' && /^#[0-9a-f]{3,6}$/i.test(c) ? c : '#00ff00';
      }
      const res = await removeBg(file, {
        color,
        tolerance: num(p['bg-tolerance']) ?? 25,
        feather: p['bg-feather'] !== false,
      });
      return {
        blob: res.blob,
        name: removeBgName(file.name),
        width: res.meta.width,
        height: res.meta.height,
      };
    },
  });
}
