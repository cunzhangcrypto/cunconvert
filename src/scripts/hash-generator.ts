import { initSegs, bindSeg, readParams } from './params';
import { hashText, hashFile, isLegacyAlgo, DEFAULT_ALGO, type HashAlgorithm } from '../lib/security/hash';
import { copyText, showNotice, flashButton } from './security-ui';
import { toUserMessage, formatBytes } from '../lib/utils/errors';

const ALGOS: HashAlgorithm[] = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1', 'MD5'];

type Mode = 'text' | 'file';

/** Hash 生成器：文本与文件均在浏览器本地计算，文件不会上传 */
export function mount(root: HTMLElement): void {
  initSegs(root);

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hash-mode]'));
  const panels: Record<Mode, HTMLElement | null> = {
    text: root.querySelector<HTMLElement>('[data-hash-panel="text"]'),
    file: root.querySelector<HTMLElement>('[data-hash-panel="file"]'),
  };

  const warn = root.querySelector<HTMLElement>('[data-hash-warn]');

  // 文本
  const textInput = root.querySelector<HTMLTextAreaElement>('[data-hash-text]');
  const textOut = root.querySelector<HTMLElement>('[data-hash-output]');
  const textCopy = root.querySelector<HTMLButtonElement>('[data-hash-copy]');
  const textRun = root.querySelector<HTMLButtonElement>('[data-hash-run]');
  const textClear = root.querySelector<HTMLButtonElement>('[data-hash-clear]');

  // 文件
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const fileInput = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const fileMeta = root.querySelector<HTMLElement>('[data-hash-file-meta]');
  const fileOut = root.querySelector<HTMLElement>('[data-hash-file-output]');
  const fileCopy = root.querySelector<HTMLButtonElement>('[data-hash-file-copy]');

  if (!textOut) return;

  let mode: Mode = 'text';
  /** 当前待计算的文件（切换算法时需要重算） */
  let currentFile: File | null = null;
  /** 计算代际：只让最新一次结果落地 */
  let seq = 0;

  function readAlgo(): HashAlgorithm {
    const v = String(readParams(root)['hash-algo'] ?? DEFAULT_ALGO);
    return (ALGOS as string[]).includes(v) ? (v as HashAlgorithm) : DEFAULT_ALGO;
  }

  function setPlaceholder(el: HTMLElement, text: string): void {
    el.textContent = text;
    el.classList.add('placeholder');
  }

  function setValue(el: HTMLElement, text: string): void {
    el.textContent = text;
    el.classList.remove('placeholder');
  }

  function setMode(next: Mode): void {
    mode = next;
    for (const t of tabs) t.classList.toggle('active', t.dataset.hashMode === next);
    for (const m of ['text', 'file'] as Mode[]) {
      const p = panels[m];
      if (p) p.hidden = m !== next;
    }
  }

  function updateWarn(): void {
    if (!warn) return;
    warn.hidden = !isLegacyAlgo(readAlgo());
  }

  // ---------- 文本 ----------
  async function runText(): Promise<void> {
    const text = textInput?.value ?? '';
    if (!text) {
      setPlaceholder(textOut!, '输入内容后点击「计算 Hash」');
      if (textCopy) textCopy.hidden = true;
      return;
    }
    const my = ++seq;
    try {
      const hex = await hashText(text, readAlgo());
      if (my !== seq) return;
      setValue(textOut!, hex);
      if (textCopy) textCopy.hidden = false;
      showNotice(root, '');
    } catch (e) {
      if (my !== seq) return;
      showNotice(root, toUserMessage(e));
    }
  }

  function clearText(): void {
    if (textInput) textInput.value = '';
    setPlaceholder(textOut!, '输入内容后点击「计算 Hash」');
    if (textCopy) textCopy.hidden = true;
    showNotice(root, '');
    textInput?.focus();
  }

  // ---------- 文件 ----------
  async function runFile(file: File): Promise<void> {
    currentFile = file;
    if (fileMeta) fileMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
    setPlaceholder(fileOut!, '计算中…');
    if (fileCopy) fileCopy.hidden = true;

    const my = ++seq;
    try {
      const hex = await hashFile(file, readAlgo());
      if (my !== seq) return;
      setValue(fileOut!, hex);
      if (fileCopy) fileCopy.hidden = false;
      showNotice(root, '');
    } catch (e) {
      if (my !== seq) return;
      setPlaceholder(fileOut!, '计算失败，请重试');
      showNotice(root, toUserMessage(e));
    }
  }

  function acceptFile(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    void runFile(file);
  }

  // ---------- 事件 ----------
  for (const t of tabs) {
    t.addEventListener('click', () => setMode((t.dataset.hashMode as Mode) ?? 'text'));
  }

  bindSeg(root, 'hash-algo', () => {
    updateWarn();
    if (mode === 'text') {
      if (textInput?.value) void runText();
    } else if (currentFile) {
      void runFile(currentFile);
    }
  });

  textRun?.addEventListener('click', () => void runText());
  textClear?.addEventListener('click', clearText);

  browse?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });
  dropzone?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-browse]')) return;
    fileInput?.click();
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
  fileInput?.addEventListener('change', () => {
    acceptFile(fileInput.files);
    fileInput.value = '';
  });

  function wireCopy(btn: HTMLButtonElement | null, get: () => string): void {
    btn?.addEventListener('click', () => {
      const text = get();
      if (!text) return;
      copyText(text)
        .then(() => flashButton(btn))
        .catch(() => showNotice(root, '复制失败，请手动选中后复制', 'warn'));
    });
  }
  wireCopy(textCopy, () => textOut.textContent ?? '');
  wireCopy(fileCopy, () => fileOut?.textContent ?? '');

  // ---------- 初始化 ----------
  setMode('text');
  updateWarn();
  setPlaceholder(textOut, '输入内容后点击「计算 Hash」');
  if (fileOut) setPlaceholder(fileOut, '选择或拖入文件后自动计算');
  if (textCopy) textCopy.hidden = true;
  if (fileCopy) fileCopy.hidden = true;
}
