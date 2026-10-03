import { initConvertTool } from './convert-ui';
import { initSegs, bindSeg } from './params';
import { runSvgo } from '../lib/svg/svgo-loader';
import { calcSaved, replaceExt } from '../lib/utils/file';

/** SVG 优化器 */
export function mount(root: HTMLElement): void {
  initSegs(root);

  // 「保留 viewBox」只在高级模式下提供（原先该行恒为 display:none，永远看不到）
  const viewBoxRow = root
    .querySelector<HTMLInputElement>('input[data-param="keep-viewbox"]')
    ?.closest<HTMLElement>('.input-row');
  bindSeg(root, 'svgo-mode', (v) => {
    if (viewBoxRow) viewBoxRow.style.display = v === 'advanced' ? '' : 'none';
  });

  initConvertTool(root, {
    async convert(file, p) {
      const text = await file.text();
      const out = await runSvgo(text, {
        multipass: p['svgo-mode'] === 'advanced',
        keepViewBox: p['keep-viewbox'] !== false,
      });
      const blob = new Blob([out], { type: 'image/svg+xml' });
      return {
        blob,
        name: replaceExt(file.name, 'svg'),
        savedPercent: calcSaved(file.size, blob.size),
      };
    },
    preview: (blob) => URL.createObjectURL(blob),
  });
}
