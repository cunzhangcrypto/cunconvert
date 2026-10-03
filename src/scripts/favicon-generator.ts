import { initSegs, initRangeHints, initColorRows, readParams, num, resolveBackgroundParam } from './params';
import { generateFaviconSet, faviconHtmlCode, type FaviconOpts } from '../lib/favicon/favicon';
import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob } from '../lib/utils/file';
import { zipBlobs } from '../lib/zip/jszip-loader';

/** Favicon 生成：上传一张图，本地生成整套图标 + ICO + HTML 引用代码 */
export function mount(root: HTMLElement): void {
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const input = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const panel = root.querySelector<HTMLElement>('[data-fx-panel]');
  const grid = root.querySelector<HTMLElement>('[data-fx-grid]');
  const codeBox = root.querySelector<HTMLElement>('[data-fx-code]');
  const zipBtn = root.querySelector<HTMLButtonElement>('[data-fx-zip]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-fx-copy]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (!input) return;

  initSegs(root);
  initRangeHints(root);
  initColorRows(root);

  let source: File | null = null;
  let outputs: { name: string; blob: Blob }[] = [];
  const urls: string[] = [];
  let busy = false;

  function showNotice(msg: string, kind: 'info' | 'warn' | 'error' = 'error'): void {
    if (!notice) return;
    notice.innerHTML = '';
    if (!msg) return;
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    notice.appendChild(div);
  }

  function readOpts(): FaviconOpts {
    const p = readParams(root);
    return {
      fit: (p['fx-fit'] as FaviconOpts['fit']) ?? 'contain',
      background: resolveBackgroundParam(p, true),
      padding: num(p['fx-padding']) ?? 0,
    };
  }

  function renderGrid(): void {
    if (!grid) return;
    for (const u of urls) URL.revokeObjectURL(u);
    urls.length = 0;
    grid.innerHTML = '';

    for (const o of outputs) {
      const url = URL.createObjectURL(o.blob);
      urls.push(url);

      const cell = document.createElement('div');
      cell.className = 'fx-cell';

      const thumbBox = document.createElement('div');
      thumbBox.className = 'fx-thumb-box';
      const img = document.createElement('img');
      img.className = 'fx-thumb';
      img.src = url;
      img.alt = o.name;
      thumbBox.appendChild(img);

      const name = document.createElement('div');
      name.className = 'fx-name';
      name.textContent = o.name;
      name.title = o.name;

      const meta = document.createElement('div');
      meta.className = 'fx-meta';
      meta.textContent = formatBytes(o.blob.size);

      const dl = document.createElement('button');
      dl.type = 'button';
      dl.className = 'btn-small';
      dl.textContent = '下载';
      dl.addEventListener('click', () => downloadBlob(o.blob, o.name));

      cell.append(thumbBox, name, meta, dl);
      grid.appendChild(cell);
    }
  }

  async function generate(): Promise<void> {
    if (!source || busy) return;
    busy = true;
    try {
      showNotice('');
      outputs = await generateFaviconSet(source, readOpts());
      renderGrid();
      if (codeBox) codeBox.textContent = faviconHtmlCode();
      if (panel) panel.hidden = false;
    } catch (e) {
      showNotice(toUserMessage(e));
    } finally {
      busy = false;
    }
  }

  function acceptFile(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showNotice('请选择 PNG / JPG / WebP 等图片文件');
      return;
    }
    source = file;
    void generate();
  }

  browse?.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  dropzone?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-browse]')) return;
    input.click();
  });
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    acceptFile(e.dataTransfer?.files ?? null);
  });
  input.addEventListener('change', () => {
    acceptFile(input.files);
    input.value = '';
  });

  // 参数变化后重新生成
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-param]')) void generate();
  });
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.seg button')) void generate();
  });

  zipBtn?.addEventListener('click', async () => {
    if (outputs.length === 0) return;
    try {
      const blob = await zipBlobs(outputs, 'favicon-pack.zip');
      downloadBlob(blob, 'favicon-pack.zip');
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  });

  copyBtn?.addEventListener('click', () => {
    navigator.clipboard
      .writeText(faviconHtmlCode())
      .then(() => showNotice('HTML 代码已复制到剪贴板', 'info'))
      .catch(() => showNotice('复制失败，请手动选择代码复制', 'warn'));
  });
}
