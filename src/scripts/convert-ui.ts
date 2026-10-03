import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob, sanitizeName } from '../lib/utils/file';
import { runBatch } from '../lib/converters/batch';
import { zipBlobs } from '../lib/zip/jszip-loader';
import { readParams, type Params } from './params';

export interface ConvertOutput {
  blob: Blob;
  /** 输出文件名（含扩展名） */
  name: string;
  width?: number;
  height?: number;
  savedPercent?: number;
}

export interface ConvertToolOptions {
  /**
   * 转换单文件（可返回多张结果，如平台预设一次输出多个规格）。
   * 抛出的异常会被转为中文提示。
   */
  convert?(
    file: File,
    params: Params,
    info: { index: number; total: number },
  ): Promise<ConvertOutput | ConvertOutput[]>;
  /**
   * 合并模式：把全部文件当作一个整体处理，只输出一次结果
   * （如「多张图片合成一个 PDF」「多个 PDF 合并」）。提供后优先于 convert。
   */
  convertAll?(
    files: File[],
    params: Params,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ConvertOutput | ConvertOutput[]>;
  /** 自定义参数读取（如裁剪工具需要读取画布选区） */
  getParams?(scope: HTMLElement): Params;
  /** 文件加入列表后的回调（如裁剪工具需要加载首张图到画布） */
  onFiles?(files: File[], scope: HTMLElement): void;
  /** 结果缩略图 URL，默认 objectURL */
  preview?(blob: Blob): string | Promise<string>;
  /** 文件列表可拖拽排序（图片转 PDF、PDF 合并等需要按顺序输出的工具） */
  sortable?: boolean;
}

interface FileItem {
  file: File;
  row: HTMLElement;
  thumb: HTMLImageElement;
  status: HTMLElement;
  results: ConvertOutput[];
}

/**
 * 共享工具外壳：
 * 拖拽/点击/粘贴上传 -> 文件列表 -> 参数 -> 顺序批量转换 -> 结果列表 + ZIP 打包。
 * 全部在浏览器本地完成。
 */
export function initConvertTool(scope: HTMLElement, opts: ConvertToolOptions): void {
  const q = <T extends HTMLElement>(sel: string): T | null => scope.querySelector<T>(sel);

  const dropzone = q<HTMLElement>('[data-dropzone]');
  const input = q<HTMLInputElement>('[data-file-input]');
  const browse = q<HTMLElement>('[data-browse]');
  const fileList = q<HTMLElement>('[data-file-list]');
  const convertBtn = q<HTMLButtonElement>('[data-action="convert"]');
  const clearBtn = q<HTMLButtonElement>('[data-action="clear"]');
  const zipBtn = q<HTMLButtonElement>('[data-action="zip"]');
  const progress = q<HTMLElement>('[data-progress]');
  const progressText = q<HTMLElement>('[data-progress-text]');
  const progressBar = q<HTMLElement>('[data-progress] .bar i');
  const results = q<HTMLElement>('[data-result-list]');
  const resultItems = q<HTMLElement>('[data-result-items]');
  const notice = q<HTMLElement>('[data-notice]');

  if (!input || !fileList || !convertBtn) return;

  const items: FileItem[] = [];
  const urls: string[] = [];
  let busy = false;
  /** 合并模式（convertAll）的输出结果 */
  let mergedResults: ConvertOutput[] = [];

  const collectParams = (): Params => (opts.getParams ? opts.getParams(scope) : readParams(scope));

  function showNotice(message: string, kind: 'info' | 'warn' | 'error' = 'error'): void {
    if (!notice) return;
    notice.innerHTML = '';
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = message;
    notice.appendChild(div);
  }

  function clearNotice(): void {
    if (notice) notice.innerHTML = '';
  }

  /** 居中弹窗提示处理完成，3 秒后自动关闭 */
  function showDoneModal(title: string, sub: string): void {
    const mask = document.createElement('div');
    mask.className = 'done-mask';
    const card = document.createElement('div');
    card.className = 'done-modal';
    const icon = document.createElement('div');
    icon.className = 'done-icon';
    icon.textContent = '✓';
    const titleEl = document.createElement('div');
    titleEl.className = 'done-title';
    titleEl.textContent = title;
    const subEl = document.createElement('div');
    subEl.className = 'done-sub';
    subEl.textContent = sub;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'done-close';
    close.textContent = '知道了';
    card.append(icon, titleEl, subEl, close);
    mask.appendChild(card);
    document.body.appendChild(mask);

    let closed = false;
    const closeFn = () => {
      if (closed) return;
      closed = true;
      mask.classList.add('leaving');
      setTimeout(() => mask.remove(), 200);
    };
    close.addEventListener('click', closeFn);
    mask.addEventListener('click', (e) => {
      if (e.target === mask) closeFn();
    });
    setTimeout(closeFn, 3200);
  }

  function addFiles(list: FileList | null): void {
    if (!list || list.length === 0) return;
    clearNotice();
    const incoming: File[] = [];
    for (const file of list) {
      addFile(file);
      incoming.push(file);
    }
    opts.onFiles?.(incoming, scope);
    syncConvertState();
  }

  function makeThumb(file: File): { img: HTMLImageElement; url: string } {
    const url = URL.createObjectURL(file);
    urls.push(url);
    const img = document.createElement('img');
    img.className = 'file-thumb';
    img.alt = file.name;
    img.src = url;
    return { img, url };
  }

  function addFile(file: File): void {
    const row = document.createElement('div');
    row.className = 'file-row';

    const { img } = makeThumb(file);

    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('div');
    name.className = 'fi-name';
    name.textContent = file.name;
    name.title = file.name;
    const meta = document.createElement('div');
    meta.className = 'fi-meta';
    meta.textContent = formatBytes(file.size);
    info.append(name, meta);

    const status = document.createElement('span');
    status.className = 'file-status waiting';
    status.textContent = '等待处理';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'file-del';
    del.textContent = '✕';
    del.setAttribute('aria-label', '移除文件');
    del.addEventListener('click', () => {
      const i = items.findIndex((it) => it.row === row);
      if (i >= 0) items.splice(i, 1);
      row.remove();
      updateMoveButtons();
      syncConvertState();
    });

    const item: FileItem = { file, row, thumb: img, status, results: [] };

    if (opts.sortable) {
      row.classList.add('sortable');
      row.draggable = true;
      const move = document.createElement('div');
      move.className = 'file-move';
      const up = document.createElement('button');
      up.type = 'button';
      up.dataset.move = 'up';
      up.textContent = '↑';
      up.setAttribute('aria-label', '上移');
      up.addEventListener('click', () => moveItem(items.indexOf(item), items.indexOf(item) - 1));
      const down = document.createElement('button');
      down.type = 'button';
      down.dataset.move = 'down';
      down.textContent = '↓';
      down.setAttribute('aria-label', '下移');
      down.addEventListener('click', () => moveItem(items.indexOf(item), items.indexOf(item) + 1));
      move.append(up, down);
      row.append(img, info, status, move, del);
      row.addEventListener('dragstart', (e) => {
        dragIndex = items.indexOf(item);
        row.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', String(dragIndex));
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        dragIndex = -1;
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        moveItem(dragIndex, items.indexOf(item));
      });
    } else {
      row.append(img, info, status, del);
    }

    fileList?.appendChild(row);
    items.push(item);
    updateMoveButtons();
  }

  // ---- 文件排序（opts.sortable）----
  let dragIndex = -1;

  function applyOrder(): void {
    if (!fileList) return;
    for (const it of items) fileList.appendChild(it.row);
    updateMoveButtons();
  }

  function updateMoveButtons(): void {
    if (!opts.sortable) return;
    items.forEach((it, i) => {
      const up = it.row.querySelector<HTMLButtonElement>('[data-move="up"]');
      const down = it.row.querySelector<HTMLButtonElement>('[data-move="down"]');
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === items.length - 1;
    });
  }

  function moveItem(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    applyOrder();
  }

  function syncConvertState(): void {
    if (!convertBtn) return;
    convertBtn.disabled = items.length === 0 || busy;
    if (clearBtn) clearBtn.disabled = items.length === 0;
  }

  function setStatus(item: FileItem, text: string, cls: string): void {
    item.status.className = `file-status ${cls}`;
    item.status.textContent = text;
  }

  async function runConvert(): Promise<void> {
    if (items.length === 0) {
      showNotice('请先选择要处理的文件');
      return;
    }
    busy = true;
    syncConvertState();
    clearNotice();
    if (results) results.hidden = true;
    if (zipBtn) zipBtn.disabled = true;

    const params = collectParams();
    let firstError = '';

    try {
      if (opts.convertAll) {
        // ---- 合并模式：全部文件 → 一次输出 ----
        for (const it of items) setStatus(it, '处理中…', 'processing');
        if (progress) progress.hidden = false;
        if (progressText) progressText.textContent = `正在处理 ${items.length} 个文件`;
        if (progressBar) progressBar.style.width = '8%';
        try {
          const out = await opts.convertAll(items.map((it) => it.file), params, (done, total) => {
            if (progressText) progressText.textContent = `正在处理 ${done} / ${total}`;
            if (progressBar) progressBar.style.width = `${Math.round((done / total) * 100)}%`;
          });
          mergedResults = Array.isArray(out) ? out : [out];
          for (const it of items) setStatus(it, '已合并', 'done');
          for (const o of mergedResults) await renderOutput(o);
          if (progressText) progressText.textContent = '处理完成';
          if (progressBar) progressBar.style.width = '100%';
          if (progress) setTimeout(() => { progress.hidden = true; }, 1600);
          if (results) results.hidden = false;
          if (zipBtn) zipBtn.disabled = false;
          showDoneModal('处理完成', `已生成 ${mergedResults.length} 个文件，可点击下载`);
        } catch (e) {
          for (const it of items) setStatus(it, '失败', 'failed');
          if (progress) progress.hidden = true;
          firstError = toUserMessage(e);
        }
      } else if (opts.convert) {
        // ---- 逐文件模式 ----
        const convert = opts.convert;
        await runBatch(
          items,
          async (item, i) => {
            setStatus(item, '处理中…', 'processing');
            if (progress) progress.hidden = false;
            if (progressText) progressText.textContent = `正在处理 ${i + 1} / ${items.length}`;
            if (progressBar) progressBar.style.width = `${(i / items.length) * 100}%`;
            try {
              const out = await convert(item.file, params, { index: i, total: items.length });
              item.results = Array.isArray(out) ? out : [out];
              setStatus(item, item.results.length > 1 ? `已完成 ${item.results.length} 张` : '已完成', 'done');
              for (const o of item.results) await renderOutput(o);
            } catch (e) {
              item.results = [];
              setStatus(item, '失败', 'failed');
              if (!firstError) firstError = toUserMessage(e);
            }
          },
          {
            onProgress: (done, total) => {
              if (progressText) progressText.textContent = `正在处理 ${done} / ${total}`;
              if (progressBar) progressBar.style.width = `${(done / total) * 100}%`;
            },
          },
        );

        const doneCount = items.filter((it) => it.results.length > 0).length;
        const failCount = items.length - doneCount;
        if (doneCount > 0) {
          if (progressText) progressText.textContent = failCount === 0 ? '转换完成' : `转换完成，${failCount} 个失败`;
          if (progressBar) progressBar.style.width = '100%';
          if (progress) setTimeout(() => { progress.hidden = true; }, 1600);
        } else {
          if (progress) progress.hidden = true;
        }
        if (doneCount > 0) {
          if (results) results.hidden = false;
          if (zipBtn) zipBtn.disabled = false;
          showDoneModal(
            failCount === 0 ? '处理完成' : '处理完成（部分失败）',
            failCount === 0 ? `成功转换 ${doneCount} 个文件，可点击下载` : `成功 ${doneCount} 个，失败 ${failCount} 个`,
          );
        }
        if (doneCount === 0 && !firstError) {
          showNotice('没有文件处理成功，请检查文件格式后重试', 'warn');
        }
      }

      if (firstError) showNotice(firstError);
    } finally {
      busy = false;
      syncConvertState();
    }
  }

  async function renderOutput(out: ConvertOutput): Promise<void> {
    if (!resultItems) return;

    let thumbUrl = '';
    try {
      thumbUrl = opts.preview ? await opts.preview(out.blob) : URL.createObjectURL(out.blob);
      if (thumbUrl) urls.push(thumbUrl);
    } catch {
      thumbUrl = '';
    }

    const row = document.createElement('div');
    row.className = 'result-row';

    let thumbEl: HTMLElement;
    if (thumbUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'result-thumb';
      thumb.alt = out.name;
      thumb.src = thumbUrl;
      thumbEl = thumb;
    } else {
      const ph = document.createElement('span');
      ph.className = 'result-thumb result-thumb-ph';
      ph.textContent = (out.name.split('.').pop() ?? '').toUpperCase().slice(0, 4);
      thumbEl = ph;
    }

    const info = document.createElement('div');
    info.className = 'result-info';
    const name = document.createElement('div');
    name.className = 'ri-name';
    name.textContent = out.name;
    name.title = out.name;
    const meta = document.createElement('div');
    meta.className = 'ri-meta';
    const sizeText = formatBytes(out.blob.size);
    let metaText = sizeText;
    if (out.width && out.height) metaText = `${out.width}×${out.height} · ${sizeText}`;
    meta.textContent = metaText;
    if (typeof out.savedPercent === 'number') {
      const save = document.createElement('span');
      save.className = 'ri-save';
      save.textContent = out.savedPercent >= 0 ? `节省 ${out.savedPercent}%` : `体积增大 ${-out.savedPercent}%`;
      meta.appendChild(save);
    }
    info.append(name, meta);

    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'btn-small';
    dl.textContent = '下载';
    dl.addEventListener('click', () => downloadBlob(out.blob, sanitizeName(out.name)));

    row.append(thumbEl, info, dl);
    resultItems.appendChild(row);
  }

  async function downloadZip(): Promise<void> {
    const list = mergedResults.length > 0 ? mergedResults : items.flatMap((it) => it.results);
    if (list.length === 0) return;
    try {
      const zipName = `cunconvert-${new Date().toISOString().slice(0, 10)}.zip`;
      const blob = await zipBlobs(list.map((r) => ({ name: sanitizeName(r.name), blob: r.blob })), zipName);
      downloadBlob(blob, zipName);
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  }

  function clearAll(): void {
    items.length = 0;
    mergedResults = [];
    if (fileList) fileList.innerHTML = '';
    if (resultItems) resultItems.innerHTML = '';
    if (results) results.hidden = true;
    if (progress) progress.hidden = true;
    if (zipBtn) zipBtn.disabled = true;
    clearNotice();
    for (const u of urls) URL.revokeObjectURL(u);
    urls.length = 0;
    syncConvertState();
  }

  // ---- 事件绑定 ----
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
    addFiles(e.dataTransfer?.files ?? null);
  });
  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = '';
  });
  window.addEventListener('paste', (e) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) addFiles(files);
  });

  convertBtn.addEventListener('click', () => void runConvert());
  clearBtn?.addEventListener('click', clearAll);
  zipBtn?.addEventListener('click', () => void downloadZip());

  syncConvertState();
}
