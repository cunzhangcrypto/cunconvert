import { initSegs, initRangeHints, bindSeg, readParams, num } from './params';
import {
  renderPdfThumbnails,
  pdfToImages,
  type PdfThumb,
} from '../lib/pdf/pdf-to-image';
import type { EncodeType } from '../lib/image/encode';
import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob, sanitizeName } from '../lib/utils/file';
import { zipBlobs } from '../lib/zip/jszip-loader';

/**
 * PDF → 图片：上传一个 PDF，渲染页面缩略图供勾选，
 * 再把选中页面导出为 PNG / JPG / WebP。全程浏览器本地完成。
 */
export function mount(root: HTMLElement): void {
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const input = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const metaLine = root.querySelector<HTMLElement>('[data-pdf-meta]');
  const panel = root.querySelector<HTMLElement>('[data-p2i-panel]');
  const grid = root.querySelector<HTMLElement>('[data-page-grid]')!;
  const selCount = root.querySelector<HTMLElement>('[data-sel-count]');
  const selectAll = root.querySelector<HTMLButtonElement>('[data-select-all]');
  const selectNone = root.querySelector<HTMLButtonElement>('[data-select-none]');
  const invert = root.querySelector<HTMLButtonElement>('[data-invert]');
  const convertBtn = root.querySelector<HTMLButtonElement>('[data-pdf-convert]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-pdf-clear]');
  const zipBtn = root.querySelector<HTMLButtonElement>('[data-pdf-zip]');
  const progress = root.querySelector<HTMLElement>('[data-pdf-progress]');
  const progressBar = root.querySelector<HTMLElement>('[data-pdf-progress] .bar i');
  const progressText = root.querySelector<HTMLElement>('[data-pdf-progress-text]');
  const results = root.querySelector<HTMLElement>('[data-pdf-results]');
  const resultItems = root.querySelector<HTMLElement>('[data-pdf-result-items]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (!input || !grid) return;

  initSegs(root);
  initRangeHints(root);

  let source: File | null = null;
  let thumbs: PdfThumb[] = [];
  const selected = new Set<number>();
  const urls: string[] = [];
  let outputs: { name: string; blob: Blob }[] = [];
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

  function setProgress(show: boolean, ratio = 0, text = ''): void {
    if (!progress) return;
    progress.hidden = !show;
    if (progressBar) progressBar.style.width = `${Math.round(ratio * 100)}%`;
    if (progressText) progressText.textContent = text;
  }

  function updateSelectionUI(): void {
    if (selCount) selCount.textContent = `已选 ${selected.size} / ${thumbs.length} 页`;
    if (convertBtn) convertBtn.disabled = busy || selected.size === 0;
    if (clearBtn) clearBtn.disabled = !source;
    grid.querySelectorAll<HTMLElement>('.p2i-cell').forEach((cell) => {
      const p = Number(cell.dataset.page);
      cell.classList.toggle('selected', selected.has(p));
    });
  }

  function renderGrid(): void {
    grid.innerHTML = '';
    for (const t of thumbs) {
      const cell = document.createElement('label');
      cell.className = 'p2i-cell';
      cell.dataset.page = String(t.page);

      const box = document.createElement('div');
      box.className = 'p2i-thumb-box';
      const img = document.createElement('img');
      img.className = 'p2i-thumb';
      img.src = t.url;
      img.alt = `第 ${t.page} 页`;
      img.loading = 'lazy';
      box.appendChild(img);

      const foot = document.createElement('div');
      foot.className = 'p2i-foot';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(t.page);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(t.page);
        else selected.delete(t.page);
        updateSelectionUI();
      });
      const no = document.createElement('span');
      no.className = 'p2i-no';
      no.textContent = `第 ${t.page} 页`;
      foot.append(cb, no);

      cell.append(box, foot);
      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });
      grid.appendChild(cell);
    }
    updateSelectionUI();
  }

  function readOpts() {
    const p = readParams(root);
    const format = (p['pdf-format'] as EncodeType) ?? 'png';
    return {
      format,
      quality: num(p['pdf-quality']) ?? 0.92,
      scale: num(p['pdf-scale']) ?? 2,
    };
  }

  async function loadFile(file: File): Promise<void> {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      showNotice('请选择 PDF 文件');
      return;
    }
    source = file;
    outputs = [];
    selected.clear();
    thumbs = [];
    grid.innerHTML = '';
    if (results) results.hidden = true;
    if (resultItems) resultItems.innerHTML = '';
    if (zipBtn) zipBtn.disabled = true;
    for (const u of urls) URL.revokeObjectURL(u);
    urls.length = 0;

    showNotice('');
    setProgress(true, 0.05, '正在解析 PDF…');
    try {
      thumbs = await renderPdfThumbnails(file, 150, (done, total) => {
        setProgress(true, done / total, `正在渲染页面预览 ${done} / ${total}`);
      });
      for (const t of thumbs) selected.add(t.page);
      if (metaLine) {
        metaLine.textContent = `${file.name} · 共 ${thumbs.length} 页 · ${formatBytes(file.size)}`;
      }
      if (panel) panel.hidden = false;
      renderGrid();
      setProgress(false);
    } catch (e) {
      showNotice(toUserMessage(e));
      setProgress(false);
      source = null;
      if (metaLine) metaLine.textContent = '';
    }
  }

  async function runConvert(): Promise<void> {
    if (!source || busy) return;
    if (selected.size === 0) {
      showNotice('请至少选择一个页面');
      return;
    }
    busy = true;
    updateSelectionUI();
    showNotice('');
    if (results) results.hidden = true;
    if (resultItems) resultItems.innerHTML = '';
    if (zipBtn) zipBtn.disabled = true;
    for (const u of urls) URL.revokeObjectURL(u);
    urls.length = 0;

    const opts = readOpts();
    const pages = [...selected].sort((a, b) => a - b);
    setProgress(true, 0, `正在导出 ${pages.length} 页…`);

    try {
      const out = await pdfToImages(source, { pages, ...opts }, (done, total) => {
        setProgress(true, done / total, `正在导出第 ${done} / ${total} 页`);
      });
      outputs = out.map((o) => ({ name: o.name, blob: o.blob }));

      for (const o of out) {
        const url = URL.createObjectURL(o.blob);
        urls.push(url);
        const row = document.createElement('div');
        row.className = 'result-row';

        const img = document.createElement('img');
        img.className = 'result-thumb';
        img.src = url;
        img.alt = o.name;

        const info = document.createElement('div');
        info.className = 'result-info';
        const name = document.createElement('div');
        name.className = 'ri-name';
        name.textContent = o.name;
        const meta = document.createElement('div');
        meta.className = 'ri-meta';
        meta.textContent = `${o.width}×${o.height} · ${formatBytes(o.blob.size)}`;
        info.append(name, meta);

        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn-small';
        dl.textContent = '下载';
        dl.addEventListener('click', () => downloadBlob(o.blob, sanitizeName(o.name)));

        row.append(img, info, dl);
        resultItems?.appendChild(row);
      }

      setProgress(true, 1, '导出完成');
      setTimeout(() => setProgress(false), 1400);
      if (results) results.hidden = false;
      if (zipBtn) zipBtn.disabled = false;
    } catch (e) {
      showNotice(toUserMessage(e));
      setProgress(false);
    } finally {
      busy = false;
      updateSelectionUI();
    }
  }

  function clearAll(): void {
    source = null;
    thumbs = [];
    selected.clear();
    outputs = [];
    grid.innerHTML = '';
    if (resultItems) resultItems.innerHTML = '';
    if (results) results.hidden = true;
    if (panel) panel.hidden = true;
    if (metaLine) metaLine.textContent = '';
    if (zipBtn) zipBtn.disabled = true;
    setProgress(false);
    showNotice('');
    for (const u of urls) URL.revokeObjectURL(u);
    urls.length = 0;
    updateSelectionUI();
  }

  function accept(files: FileList | null): void {
    const file = files?.[0];
    if (file) void loadFile(file);
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
    accept(e.dataTransfer?.files ?? null);
  });
  input.addEventListener('change', () => {
    accept(input.files);
    input.value = '';
  });

  selectAll?.addEventListener('click', () => {
    for (const t of thumbs) selected.add(t.page);
    renderGrid();
  });
  selectNone?.addEventListener('click', () => {
    selected.clear();
    renderGrid();
  });
  invert?.addEventListener('click', () => {
    for (const t of thumbs) {
      if (selected.has(t.page)) selected.delete(t.page);
      else selected.add(t.page);
    }
    renderGrid();
  });

  convertBtn?.addEventListener('click', () => void runConvert());
  clearBtn?.addEventListener('click', clearAll);
  zipBtn?.addEventListener('click', async () => {
    if (outputs.length === 0) return;
    try {
      const blob = await zipBlobs(outputs, 'pdf-images.zip');
      downloadBlob(blob, 'pdf-images.zip');
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  });

  // JPG / WebP 才有质量可调；PNG 无损
  bindSeg(root, 'pdf-format', (v) => {
    const block = root.querySelector<HTMLElement>('[data-quality-block]');
    if (block) block.style.display = v === 'png' ? 'none' : '';
  });

  updateSelectionUI();
}
