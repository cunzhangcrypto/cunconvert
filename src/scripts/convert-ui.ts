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
   * 转换单文件。抛出的异常会被转为中文提示。
   */
  convert(file: File, params: Params, info: { index: number; total: number }): Promise<ConvertOutput>;
  /** 自定义参数读取（如裁剪工具需要读取画布选区） */
  getParams?(scope: HTMLElement): Params;
  /** 文件加入列表后的回调（如裁剪工具需要加载首张图到画布） */
  onFiles?(files: File[], scope: HTMLElement): void;
  /** 结果缩略图 URL，默认 objectURL */
  preview?(blob: Blob): string | Promise<string>;
}

interface FileItem {
  file: File;
  row: HTMLElement;
  thumb: HTMLImageElement;
  status: HTMLElement;
  result?: ConvertOutput;
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
      syncConvertState();
    });

    row.append(img, info, status, del);
    fileList?.appendChild(row);

    items.push({ file, row, thumb: img, status });
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
      await runBatch(
        items,
        async (item, i) => {
          setStatus(item, '处理中…', 'processing');
          if (progress) progress.hidden = false;
          if (progressText) progressText.textContent = `正在处理 ${i + 1} / ${items.length}`;
          if (progressBar) progressBar.style.width = `${(i / items.length) * 100}%`;
          try {
            const out = await opts.convert(item.file, params, { index: i, total: items.length });
            item.result = out;
            setStatus(item, '已完成', 'done');
            renderResult(item);
          } catch (e) {
            item.result = undefined;
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

      if (progress) progress.hidden = true;
      if (items.some((it) => it.result)) {
        if (results) results.hidden = false;
        if (zipBtn) zipBtn.disabled = false;
      }
      if (firstError) showNotice(firstError);
      if (!items.some((it) => it.result) && !firstError) {
        showNotice('没有文件处理成功，请检查文件格式后重试', 'warn');
      }
    } finally {
      busy = false;
      syncConvertState();
    }
  }

  async function renderResult(item: FileItem): Promise<void> {
    const out = item.result;
    if (!out || !resultItems) return;

    let thumbUrl = '';
    try {
      thumbUrl = opts.preview ? await opts.preview(out.blob) : URL.createObjectURL(out.blob);
      if (thumbUrl) urls.push(thumbUrl);
    } catch {
      thumbUrl = '';
    }

    const row = document.createElement('div');
    row.className = 'result-row';

    const thumb = document.createElement('img');
    thumb.className = 'result-thumb';
    thumb.alt = out.name;
    if (thumbUrl) thumb.src = thumbUrl;

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

    row.append(thumb, info, dl);
    resultItems.appendChild(row);
  }

  async function downloadZip(): Promise<void> {
    const list = items.filter((it) => it.result).map((it) => it.result as ConvertOutput);
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
