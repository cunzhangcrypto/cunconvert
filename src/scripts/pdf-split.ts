import { initSegs, initRangeHints, bindSeg, readParams, num } from './params';
import { renderPdfThumbnails, type PdfThumb } from '../lib/pdf/pdf-to-image';
import { splitPdf, type SplitMode } from '../lib/pdf/pdf-split';
import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob, sanitizeName } from '../lib/utils/file';
import { zipBlobs } from '../lib/zip/jszip-loader';

/**
 * PDF 拆分：上传一个 PDF，按「每页单独 / 选中页 / 每 N 页一组」拆成多份。
 * 全程浏览器本地完成。
 */
export function mount(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const metaLine = root.querySelector<HTMLElement>('[data-pdf-meta]');
  const panel = root.querySelector<HTMLElement>('[data-split-panel]');
  const grid = root.querySelector<HTMLElement>('[data-page-grid]')!;
  const selectTools = root.querySelector<HTMLElement>('[data-select-tools]');
  const chunkBlock = root.querySelector<HTMLElement>('[data-chunk-block]');
  const selCount = root.querySelector<HTMLElement>('[data-sel-count]');
  const selectAll = root.querySelector<HTMLButtonElement>('[data-select-all]');
  const selectNone = root.querySelector<HTMLButtonElement>('[data-select-none]');
  const invert = root.querySelector<HTMLButtonElement>('[data-invert]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-split-run]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-split-clear]');
  const zipBtn = root.querySelector<HTMLButtonElement>('[data-split-zip]');
  const progress = root.querySelector<HTMLElement>('[data-split-progress]');
  const progressBar = root.querySelector<HTMLElement>('[data-split-progress] .bar i');
  const progressText = root.querySelector<HTMLElement>('[data-split-progress-text]');
  const results = root.querySelector<HTMLElement>('[data-split-results]');
  const resultItems = root.querySelector<HTMLElement>('[data-split-result-items]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (!input || !grid) return;

  initSegs(root);
  initRangeHints(root);

  let source: File | null = null;
  let thumbs: PdfThumb[] = [];
  const selected = new Set<number>();
  let outputs: { name: string; blob: Blob }[] = [];
  let busy = false;
  /** 加载代际：只让最新一次 loadFile 的结果落地，避免旧加载覆盖新状态 */
  let loadSeq = 0;

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

  function mode(): SplitMode {
    return ((readParams(root)['split-mode'] as SplitMode) ?? 'each') as SplitMode;
  }

  function syncModeUI(): void {
    const m = mode();
    if (selectTools) selectTools.hidden = m !== 'range';
    if (chunkBlock) chunkBlock.style.display = m === 'chunk' ? '' : 'none';
    updateSelectionUI();
  }

  function updateSelectionUI(): void {
    if (selCount) selCount.textContent = `已选 ${selected.size} / ${thumbs.length} 页`;
    if (runBtn) runBtn.disabled = busy || !source;
  }

  function renderGrid(): void {
    grid.innerHTML = '';
    for (const t of thumbs) {
      const cell = document.createElement('label');
      cell.className = 'p2i-cell';
      cell.dataset.page = String(t.page);
      if (selected.has(t.page)) cell.classList.add('selected');

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
      const no = document.createElement('span');
      no.className = 'p2i-no';
      no.textContent = `第 ${t.page} 页`;
      foot.append(cb, no);

      const toggle = () => {
        if (cb.checked) selected.add(t.page);
        else selected.delete(t.page);
        cell.classList.toggle('selected', cb.checked);
        updateSelectionUI();
      };
      cb.addEventListener('change', toggle);
      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        // 阻止 label 默认行为再次触发复选框（否则会翻转两次、净效果无变化）
        e.preventDefault();
        cb.checked = !cb.checked;
        toggle();
      });

      cell.append(box, foot);
      grid.appendChild(cell);
    }
    updateSelectionUI();
  }

  async function loadFile(file: File): Promise<void> {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      showNotice('请选择 PDF 文件');
      return;
    }
    // 代际令牌：慢的旧加载完成后不得覆盖新状态（连续选两次文件时，
    // 先开始后完成的那次会把用户刚勾选的页静默重置为「全选」）。
    const seq = ++loadSeq;
    source = file;
    outputs = [];
    selected.clear();
    thumbs = [];
    grid.innerHTML = '';
    if (results) results.hidden = true;
    if (resultItems) resultItems.innerHTML = '';
    if (zipBtn) zipBtn.disabled = true;

    showNotice('');
    setProgress(true, 0.05, '正在解析 PDF…');
    try {
      const t = await renderPdfThumbnails(file, 130, (done, total) => {
        if (seq === loadSeq) setProgress(true, done / total, `正在渲染页面预览 ${done} / ${total}`);
      });
      if (seq !== loadSeq) return; // 已被更新的加载取代 → 本次作废
      thumbs = t;
      for (const th of thumbs) selected.add(th.page);
      if (metaLine) metaLine.textContent = `${file.name} · 共 ${thumbs.length} 页 · ${formatBytes(file.size)}`;
      if (panel) panel.hidden = false;
      renderGrid();
      syncModeUI();
      setProgress(false);
    } catch (e) {
      if (seq !== loadSeq) return;
      showNotice(toUserMessage(e));
      setProgress(false);
      source = null;
      if (metaLine) metaLine.textContent = '';
    }
  }

  async function run(): Promise<void> {
    if (!source || busy) return;
    const m = mode();
    if (m === 'range' && selected.size === 0) {
      showNotice('请至少选择一个要拆分的页面');
      return;
    }

    busy = true;
    updateSelectionUI();
    showNotice('');
    if (results) results.hidden = true;
    if (resultItems) resultItems.innerHTML = '';
    if (zipBtn) zipBtn.disabled = true;

    const p = readParams(root);
    const chunkSize = Math.max(1, Math.floor(num(p['chunk-size']) ?? 1));
    setProgress(true, 0, '正在拆分…');

    try {
      const out = await splitPdf(
        source,
        source.name,
        { mode: m, pages: [...selected].sort((a, b) => a - b), chunkSize },
        (done, total) => setProgress(true, done / total, `正在生成第 ${done} / ${total} 份`),
      );
      outputs = out;

      for (const o of out) {
        const row = document.createElement('div');
        row.className = 'result-row';

        const ph = document.createElement('span');
        ph.className = 'result-thumb result-thumb-ph';
        ph.textContent = 'PDF';

        const info = document.createElement('div');
        info.className = 'result-info';
        const name = document.createElement('div');
        name.className = 'ri-name';
        name.textContent = o.name;
        const meta = document.createElement('div');
        meta.className = 'ri-meta';
        meta.textContent = formatBytes(o.blob.size);
        info.append(name, meta);

        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn-small';
        dl.textContent = '下载';
        dl.addEventListener('click', () => downloadBlob(o.blob, sanitizeName(o.name)));

        row.append(ph, info, dl);
        resultItems?.appendChild(row);
      }

      setProgress(true, 1, `拆分完成，共 ${out.length} 份`);
      setTimeout(() => setProgress(false), 1500);
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

  bindSeg(root, 'split-mode', () => syncModeUI());

  runBtn?.addEventListener('click', () => void run());
  clearBtn?.addEventListener('click', clearAll);
  zipBtn?.addEventListener('click', async () => {
    if (outputs.length === 0) return;
    try {
      const blob = await zipBlobs(outputs, 'pdf-split.zip');
      downloadBlob(blob, 'pdf-split.zip');
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  });

  syncModeUI();
}
