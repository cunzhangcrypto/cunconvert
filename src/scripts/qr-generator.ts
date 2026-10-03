import { initSegs, initRangeHints, initColorRows, readParams, num } from './params';
import {
  qrToCanvas,
  qrToPngBlob,
  qrToSvg,
  qrBatchToPngBlobs,
  QR_DEFAULTS,
  QR_PREVIEW_SIZE,
  type QrOpts,
} from '../lib/qr/qrcode';
import { toUserMessage } from '../lib/utils/errors';
import { downloadBlob, sanitizeName } from '../lib/utils/file';
import { zipBlobs } from '../lib/zip/jszip-loader';

type Mode = 'url' | 'text' | 'batch';

interface Panel {
  el: HTMLElement;
  canvas: HTMLCanvasElement | null;
  empty: HTMLElement | null;
  png: HTMLButtonElement | null;
  svg: HTMLButtonElement | null;
}

const MODES: Mode[] = ['url', 'text', 'batch'];

/**
 * 二维码生成：网址链接 / 文本生成 / 批量生成 三个独立版块。
 * 实时预览固定按 QR_PREVIEW_SIZE 渲染（避免大尺寸画布被 CSS 压扁变形），
 * 导出时才使用用户选择的尺寸。内容不出浏览器。
 */
export function mount(root: HTMLElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-qr-mode]'));
  const urlInput = root.querySelector<HTMLInputElement>('[data-qr-url]');
  const textInput = root.querySelector<HTMLTextAreaElement>('[data-qr-text]');
  const batchInput = root.querySelector<HTMLTextAreaElement>('[data-qr-batch]');
  const batchRun = root.querySelector<HTMLButtonElement>('[data-qr-batch-run]');
  const batchClear = root.querySelector<HTMLButtonElement>('[data-qr-batch-clear]');
  const batchZip = root.querySelector<HTMLButtonElement>('[data-qr-batch-zip]');
  const batchProgress = root.querySelector<HTMLElement>('[data-qr-batch-progress]');
  const batchProgressBar = root.querySelector<HTMLElement>('[data-qr-batch-progress] .bar i');
  const batchProgressText = root.querySelector<HTMLElement>('[data-qr-batch-progress-text]');
  const batchResults = root.querySelector<HTMLElement>('[data-qr-batch-results]');
  const batchGrid = root.querySelector<HTMLElement>('[data-qr-batch-grid]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (tabs.length === 0) return;

  initSegs(root);
  initRangeHints(root);
  initColorRows(root);

  const panels: Record<Mode, Panel | null> = { url: null, text: null, batch: null };
  for (const m of MODES) {
    const el = root.querySelector<HTMLElement>(`[data-qr-panel="${m}"]`);
    panels[m] = el
      ? {
          el,
          canvas: el.querySelector<HTMLCanvasElement>('[data-qr-canvas]'),
          empty: el.querySelector<HTMLElement>('[data-qr-empty]'),
          png: el.querySelector<HTMLButtonElement>('[data-qr-png]'),
          svg: el.querySelector<HTMLButtonElement>('[data-qr-svg]'),
        }
      : null;
  }

  let mode: Mode = 'url';
  let timer: number | undefined;
  let busy = false;
  const batchUrls: string[] = [];
  let batchOutputs: { name: string; blob: Blob }[] = [];

  function showNotice(msg: string, kind: 'info' | 'warn' | 'error' = 'error'): void {
    if (!notice) return;
    notice.innerHTML = '';
    if (!msg) return;
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    notice.appendChild(div);
  }

  function readOpts(): QrOpts {
    const p = readParams(root);
    return {
      size: num(p['qr-size']) ?? QR_DEFAULTS.size,
      margin: num(p['qr-margin']) ?? QR_DEFAULTS.margin,
      dark: typeof p['qr-dark'] === 'string' ? p['qr-dark'] : QR_DEFAULTS.dark,
      light: typeof p['qr-light'] === 'string' ? p['qr-light'] : QR_DEFAULTS.light,
      level: (p['qr-level'] as QrOpts['level']) ?? QR_DEFAULTS.level,
    };
  }

  /** 当前版块要编码的内容（批量版块不走实时预览） */
  function currentText(): string {
    if (mode === 'url') return urlInput?.value.trim() ?? '';
    if (mode === 'text') return textInput?.value.trim() ?? '';
    return '';
  }

  async function render(): Promise<void> {
    if (mode === 'batch') return;
    const panel = panels[mode];
    if (!panel?.canvas) return;

    const text = currentText();
    if (!text) {
      panel.canvas.hidden = true;
      if (panel.empty) panel.empty.hidden = false;
      return;
    }

    try {
      await qrToCanvas(panel.canvas, text, { ...readOpts(), size: QR_PREVIEW_SIZE });
      panel.canvas.hidden = false;
      if (panel.empty) panel.empty.hidden = true;
      showNotice('');
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => void render(), 160);
  }

  function setMode(next: Mode): void {
    mode = next;
    for (const t of tabs) t.classList.toggle('active', t.dataset.qrMode === next);
    for (const m of MODES) {
      const p = panels[m];
      if (p) p.el.hidden = m !== next;
    }
    if (next !== 'batch') void render();
  }

  async function download(kind: 'png' | 'svg'): Promise<void> {
    const text = currentText();
    if (!text) {
      showNotice('请先输入要生成二维码的内容');
      return;
    }
    try {
      const opts = readOpts();
      if (kind === 'png') {
        downloadBlob(await qrToPngBlob(text, opts), 'qrcode.png');
      } else {
        const svg = await qrToSvg(text, opts);
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qrcode.svg');
      }
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  }

  function clearBatchOutputs(): void {
    for (const u of batchUrls) URL.revokeObjectURL(u);
    batchUrls.length = 0;
    batchOutputs = [];
    if (batchGrid) batchGrid.innerHTML = '';
    if (batchResults) batchResults.hidden = true;
  }

  async function runBatch(): Promise<void> {
    if (busy) return;
    busy = true;
    if (batchRun) batchRun.disabled = true;
    showNotice('');
    clearBatchOutputs();

    const lines = (batchInput?.value ?? '').split('\n');
    const contents = lines.map((l) => l.trim()).filter(Boolean);

    try {
      if (batchProgress) batchProgress.hidden = false;
      if (batchProgressBar) batchProgressBar.style.width = '5%';
      if (batchProgressText) batchProgressText.textContent = '正在生成…';

      const out = await qrBatchToPngBlobs(lines, readOpts(), (done, total) => {
        if (batchProgressBar) batchProgressBar.style.width = `${Math.round((done / total) * 100)}%`;
        if (batchProgressText) batchProgressText.textContent = `正在生成 ${done} / ${total}`;
      });
      batchOutputs = out;

      out.forEach((item, i) => {
        const url = URL.createObjectURL(item.blob);
        batchUrls.push(url);

        const cell = document.createElement('div');
        cell.className = 'qr-batch-cell';

        const img = document.createElement('img');
        img.className = 'qr-batch-thumb';
        img.src = url;
        img.alt = item.name;

        const no = document.createElement('div');
        no.className = 'qr-batch-no';
        no.textContent = `#${i + 1}`;

        const txt = document.createElement('div');
        txt.className = 'qr-batch-text';
        txt.textContent = contents[i] ?? '';
        txt.title = contents[i] ?? '';

        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn-small';
        dl.textContent = '下载';
        dl.addEventListener('click', () => downloadBlob(item.blob, sanitizeName(item.name)));

        cell.append(img, no, txt, dl);
        batchGrid?.appendChild(cell);
      });

      if (batchProgressText) batchProgressText.textContent = `完成，共 ${out.length} 个`;
      if (batchProgress) setTimeout(() => { batchProgress.hidden = true; }, 1500);
      if (batchResults) batchResults.hidden = false;
    } catch (e) {
      if (batchProgress) batchProgress.hidden = true;
      showNotice(toUserMessage(e));
    } finally {
      busy = false;
      if (batchRun) batchRun.disabled = false;
    }
  }

  // ---- 事件绑定 ----
  for (const t of tabs) {
    t.addEventListener('click', () => setMode((t.dataset.qrMode as Mode) ?? 'url'));
  }

  urlInput?.addEventListener('input', schedule);
  textInput?.addEventListener('input', schedule);

  // 参数变化后重新渲染当前版块（批量版块不实时渲染）
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLElement;
    if (el === urlInput || el === textInput || el === batchInput) return;
    if (el.closest('[data-param]')) schedule();
  });
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('.qr-tab')) return;
    if (el.closest('.seg button')) schedule();
  });

  for (const m of ['url', 'text'] as Mode[]) {
    panels[m]?.png?.addEventListener('click', () => void download('png'));
    panels[m]?.svg?.addEventListener('click', () => void download('svg'));
  }

  batchRun?.addEventListener('click', () => void runBatch());
  batchClear?.addEventListener('click', () => {
    if (batchInput) batchInput.value = '';
    clearBatchOutputs();
    showNotice('');
  });
  batchZip?.addEventListener('click', async () => {
    if (batchOutputs.length === 0) return;
    try {
      const blob = await zipBlobs(batchOutputs, 'qrcodes.zip');
      downloadBlob(blob, 'qrcodes.zip');
    } catch (e) {
      showNotice(toUserMessage(e));
    }
  });

  setMode('url');
}
