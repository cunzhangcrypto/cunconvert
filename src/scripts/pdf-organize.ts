import { renderPdfThumbnails, type PdfThumb } from '../lib/pdf/pdf-to-image';
import { organizePdf } from '../lib/pdf/pdf-organize';
import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob } from '../lib/utils/file';

interface OrgPage {
  /** 源文档页码（1-based），导出时按它复制 */
  source: number;
  /** 追加旋转角度 0/90/180/270 */
  rotation: number;
  url: string;
}

/** PDF 页面管理：删除 / 排序 / 旋转后导出，全部浏览器本地完成 */
export function mount(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const metaLine = root.querySelector<HTMLElement>('[data-pdf-meta]');
  const panel = root.querySelector<HTMLElement>('[data-org-panel]');
  const list = root.querySelector<HTMLElement>('[data-org-list]')!;
  const countLine = root.querySelector<HTMLElement>('[data-org-count]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-org-run]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-org-reset]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-org-clear]');
  const progress = root.querySelector<HTMLElement>('[data-org-progress]');
  const progressBar = root.querySelector<HTMLElement>('[data-org-progress] .bar i');
  const progressText = root.querySelector<HTMLElement>('[data-org-progress-text]');
  const results = root.querySelector<HTMLElement>('[data-org-results]');
  const resultItems = root.querySelector<HTMLElement>('[data-org-result-items]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (!input || !list) return;

  let source: File | null = null;
  let thumbs: PdfThumb[] = [];
  let pages: OrgPage[] = [];
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

  function updateUI(): void {
    if (countLine) countLine.textContent = `共 ${pages.length} 页（原文档 ${thumbs.length} 页）`;
    if (runBtn) runBtn.disabled = busy || !source || pages.length === 0;
    if (resetBtn) resetBtn.disabled = !source;
    if (clearBtn) clearBtn.disabled = !source;
  }

  function resetPages(): void {
    pages = thumbs.map((t) => ({ source: t.page, rotation: 0, url: t.url }));
  }

  function rotate(i: number, delta: number): void {
    pages[i].rotation = (((pages[i].rotation + delta) % 360) + 360) % 360;
    renderList();
  }

  function move(i: number, dir: number): void {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    [pages[i], pages[j]] = [pages[j], pages[i]];
    renderList();
  }

  function remove(i: number): void {
    pages.splice(i, 1);
    renderList();
  }

  function iconBtn(label: string, title: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'org-btn';
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderList(): void {
    list.innerHTML = '';

    if (pages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'org-empty';
      empty.textContent = '所有页面都被删除了，请点「重置」恢复。';
      list.appendChild(empty);
      updateUI();
      return;
    }

    pages.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'org-row';

      const box = document.createElement('div');
      box.className = 'org-thumb-box';
      const img = document.createElement('img');
      img.className = 'org-thumb';
      img.src = p.url;
      img.alt = `第 ${i + 1} 页`;
      img.style.transform = `rotate(${p.rotation}deg)`;
      box.appendChild(img);

      const info = document.createElement('div');
      info.className = 'org-info';
      const pos = document.createElement('div');
      pos.className = 'org-pos';
      pos.textContent = `第 ${i + 1} 页`;
      info.appendChild(pos);
      if (p.rotation !== 0) {
        const badge = document.createElement('span');
        badge.className = 'org-badge';
        badge.textContent = `旋转 ${p.rotation}°`;
        info.appendChild(badge);
      }

      const tools = document.createElement('div');
      tools.className = 'org-tools';
      tools.append(
        iconBtn('⟲', '左转 90°', () => rotate(i, -90)),
        iconBtn('⟳', '右转 90°', () => rotate(i, 90)),
        iconBtn('↑', '上移', () => move(i, -1), i === 0),
        iconBtn('↓', '下移', () => move(i, 1), i === pages.length - 1),
        iconBtn('✕', '删除此页', () => remove(i)),
      );

      row.append(box, info, tools);
      list.appendChild(row);
    });

    updateUI();
  }

  async function loadFile(file: File): Promise<void> {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      showNotice('请选择 PDF 文件');
      return;
    }
    // 代际令牌：慢的旧加载完成后不得覆盖新状态。
    // 没有它时，「连续选两次文件」会让先开始、后完成的那次
    // 调 resetPages() 把用户刚做的旋转/排序/删除静默清空。
    const seq = ++loadSeq;
    source = file;
    thumbs = [];
    pages = [];
    list.innerHTML = '';
    if (resultItems) resultItems.innerHTML = '';
    if (results) results.hidden = true;

    showNotice('');
    setProgress(true, 0.05, '正在解析 PDF…');
    try {
      const t = await renderPdfThumbnails(file, 130, (done, total) => {
        if (seq === loadSeq) setProgress(true, done / total, `正在渲染页面预览 ${done} / ${total}`);
      });
      if (seq !== loadSeq) return; // 已被更新的加载取代 → 本次作废
      thumbs = t;
      resetPages();
      if (metaLine) metaLine.textContent = `${file.name} · 共 ${thumbs.length} 页 · ${formatBytes(file.size)}`;
      if (panel) panel.hidden = false;
      renderList();
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
    if (!source || busy || pages.length === 0) return;
    busy = true;
    updateUI();
    showNotice('');
    if (results) results.hidden = true;
    if (resultItems) resultItems.innerHTML = '';
    setProgress(true, 0, '正在导出…');

    try {
      const blob = await organizePdf(
        source,
        source.name,
        pages.map((p) => ({ source: p.source, rotation: p.rotation })),
        (done, total) => setProgress(true, done / total, `正在写入第 ${done} / ${total} 页`),
      );

      const outName = source.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      const row = document.createElement('div');
      row.className = 'result-row';
      const ph = document.createElement('span');
      ph.className = 'result-thumb result-thumb-ph';
      ph.textContent = 'PDF';
      const info = document.createElement('div');
      info.className = 'result-info';
      const name = document.createElement('div');
      name.className = 'ri-name';
      name.textContent = outName;
      const meta = document.createElement('div');
      meta.className = 'ri-meta';
      meta.textContent = `${pages.length} 页 · ${formatBytes(blob.size)}`;
      info.append(name, meta);
      const dl = document.createElement('button');
      dl.type = 'button';
      dl.className = 'btn-small';
      dl.textContent = '下载';
      dl.addEventListener('click', () => downloadBlob(blob, outName));
      row.append(ph, info, dl);
      resultItems?.appendChild(row);

      setProgress(true, 1, '导出完成');
      setTimeout(() => setProgress(false), 1400);
      if (results) results.hidden = false;
    } catch (e) {
      showNotice(toUserMessage(e));
      setProgress(false);
    } finally {
      busy = false;
      updateUI();
    }
  }

  function clearAll(): void {
    source = null;
    thumbs = [];
    pages = [];
    list.innerHTML = '';
    if (resultItems) resultItems.innerHTML = '';
    if (results) results.hidden = true;
    if (panel) panel.hidden = true;
    if (metaLine) metaLine.textContent = '';
    setProgress(false);
    showNotice('');
    updateUI();
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

  runBtn?.addEventListener('click', () => void run());
  resetBtn?.addEventListener('click', () => {
    resetPages();
    renderList();
    showNotice('已恢复为原始顺序与方向', 'info');
  });
  clearBtn?.addEventListener('click', clearAll);

  updateUI();
}
