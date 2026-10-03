import { renderMarkdown, wrapHtmlDocument } from '../lib/markdown/markdown';
import { htmlToMarkdown, guessHtmlTitle } from '../lib/markdown/html-to-md';
import { toUserMessage } from '../lib/utils/errors';
import { downloadBlob, sanitizeName } from '../lib/utils/file';

const DRAFT_KEY = 'cunconvert:md-draft';
const SAMPLE = `# 欢迎使用 CunConvert Markdown 编辑器

左边写，右边**实时预览**。所有解析都在你的浏览器本地完成，草稿会自动保存在本机。

## 支持的常见语法

- 列表、引用、表格、代码块
- **加粗**、*斜体*、~~删除线~~、\`行内代码\`
- 链接与图片：[示例链接](https://example.com)

> 隐私优先：内容不会上传到任何服务器。

\`\`\`js
console.log('hello, cunconvert');
\`\`\`

| 功能 | 状态 |
| --- | --- |
| 实时预览 | ✓ |
| 导出 HTML | ✓ |
`;

type MdMode = 'edit' | 'import';
type SrcMode = 'rich' | 'html';

const MODES: MdMode[] = ['edit', 'import'];

/**
 * Markdown 工具箱，两个版块：
 * 1) 编辑 · 预览 —— 左写右看，导入导出与本地草稿；
 * 2) 文章 / HTML 转 Markdown —— 粘贴富文本或 HTML 源码，本地转成 Markdown。
 */
export function mount(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>('[data-md-input]');
  const preview = root.querySelector<HTMLElement>('[data-md-preview]');
  const status = root.querySelector<HTMLElement>('[data-md-status]');
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  const importInput = root.querySelector<HTMLInputElement>('[data-md-import]');
  const importBtn = root.querySelector<HTMLButtonElement>('[data-md-import-btn]');
  const exportMd = root.querySelector<HTMLButtonElement>('[data-md-export-md]');
  const exportHtml = root.querySelector<HTMLButtonElement>('[data-md-export-html]');
  const copyHtml = root.querySelector<HTMLButtonElement>('[data-md-copy-html]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-md-clear]');
  if (!input || !preview) return;

  // ---- 版块切换 ----
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-md-mode]'));
  const panels: Record<MdMode, HTMLElement | null> = {
    edit: root.querySelector<HTMLElement>('[data-md-panel="edit"]'),
    import: root.querySelector<HTMLElement>('[data-md-panel="import"]'),
  };

  function setMode(next: MdMode): void {
    for (const t of tabs) t.classList.toggle('active', t.dataset.mdMode === next);
    for (const m of MODES) {
      const p = panels[m];
      if (p) p.hidden = m !== next;
    }
    if (next === 'edit') void render();
  }

  for (const t of tabs) {
    t.addEventListener('click', () => setMode((t.dataset.mdMode as MdMode) ?? 'edit'));
  }

  // ================= 版块 1：编辑 · 预览 =================
  let timer: number | undefined;
  let lastHtml = '';

  function showNotice(msg: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    if (!notice) return;
    notice.innerHTML = '';
    if (!msg) return;
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    notice.appendChild(div);
  }

  function updateStatus(): void {
    if (!status) return;
    const text = input!.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    status.textContent = `${chars} 字符 · ${words} 词 · 草稿已自动保存`;
  }

  async function render(): Promise<void> {
    try {
      const html = await renderMarkdown(input!.value);
      lastHtml = html;
      preview!.innerHTML = html;
      showNotice('');
    } catch (e) {
      showNotice(toUserMessage(e), 'error');
    }
  }

  function saveDraft(): void {
    try {
      localStorage.setItem(DRAFT_KEY, input!.value);
    } catch {
      /* 隐私模式下可能不可写，忽略 */
    }
    updateStatus();
  }

  function schedule(): void {
    saveDraft();
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => void render(), 130);
  }

  input.addEventListener('input', schedule);

  // ---- 导入 .md ----
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result ?? '');
      schedule();
      void render();
      showNotice(`已导入 ${file.name}`, 'info');
    };
    reader.onerror = () => showNotice('读取文件失败，请重试', 'error');
    reader.readAsText(file);
    importInput.value = '';
  });

  // ---- 导出 ----
  function baseName(): string {
    const first = input.value.split('\n').find((l) => l.trim().startsWith('#'));
    const title = (first ?? '').replace(/^#+\s*/, '').trim();
    return sanitizeName(title || 'document');
  }

  exportMd?.addEventListener('click', () => {
    downloadBlob(new Blob([input.value], { type: 'text/markdown;charset=utf-8' }), `${baseName()}.md`);
  });

  exportHtml?.addEventListener('click', () => {
    const html = wrapHtmlDocument(baseName(), lastHtml);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseName()}.html`);
  });

  copyHtml?.addEventListener('click', () => {
    navigator.clipboard
      .writeText(lastHtml)
      .then(() => showNotice('HTML 已复制到剪贴板', 'info'))
      .catch(() => showNotice('复制失败，请改用「导出 HTML」', 'warn'));
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    schedule();
    void render();
    showNotice('已清空编辑器', 'info');
  });

  // ================= 版块 2：文章 / HTML 转 Markdown =================
  const srcSeg = root.querySelector<HTMLElement>('[data-md-src-mode]');
  const richBox = root.querySelector<HTMLElement>('[data-md-rich]');
  const htmlBox = root.querySelector<HTMLTextAreaElement>('[data-md-html]');
  const outBox = root.querySelector<HTMLTextAreaElement>('[data-md-out]');
  const outStatus = root.querySelector<HTMLElement>('[data-md-out-status]');
  const outNotice = root.querySelector<HTMLElement>('[data-md-notice]');
  const uploadBtn = root.querySelector<HTMLButtonElement>('[data-md-html-upload-btn]');
  const uploadInput = root.querySelector<HTMLInputElement>('[data-md-html-upload]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-md-html-run]');
  const clearImportBtn = root.querySelector<HTMLButtonElement>('[data-md-html-clear]');
  const outCopy = root.querySelector<HTMLButtonElement>('[data-md-out-copy]');
  const outDownload = root.querySelector<HTMLButtonElement>('[data-md-out-download]');
  const outToEditor = root.querySelector<HTMLButtonElement>('[data-md-out-to-editor]');

  let srcMode: SrcMode = 'rich';
  let convertTimer: number | undefined;
  let lastMd = '';

  function showImportNotice(msg: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    if (!outNotice) return;
    outNotice.innerHTML = '';
    if (!msg) return;
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    outNotice.appendChild(div);
  }

  /** 取当前输入源里的 HTML 字符串 */
  function sourceHtml(): string {
    if (srcMode === 'html') return htmlBox?.value ?? '';
    return richBox?.innerHTML ?? '';
  }

  function sourceEmpty(): boolean {
    if (srcMode === 'html') return !(htmlBox?.value ?? '').trim();
    const box = richBox;
    if (!box) return true;
    return !box.textContent?.trim() && box.querySelectorAll('img,table,hr,br').length === 0;
  }

  function setSrcMode(next: SrcMode): void {
    srcMode = next;
    srcSeg?.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === next);
    });
    if (richBox) richBox.hidden = next !== 'rich';
    if (htmlBox) htmlBox.hidden = next !== 'html';
    void convert();
  }

  async function convert(): Promise<void> {
    if (!outBox) return;
    if (sourceEmpty()) {
      lastMd = '';
      outBox.value = '';
      if (outStatus) outStatus.textContent = '';
      showImportNotice('');
      return;
    }
    try {
      const md = await htmlToMarkdown(sourceHtml());
      lastMd = md;
      outBox.value = md;
      if (outStatus) {
        outStatus.textContent = `${md.length} 字符 · 转换在本地完成，内容不会上传`;
      }
      showImportNotice('');
    } catch (e) {
      showImportNotice(toUserMessage(e), 'error');
    }
  }

  function scheduleConvert(): void {
    if (convertTimer) clearTimeout(convertTimer);
    convertTimer = window.setTimeout(() => void convert(), 220);
  }

  // 富文本粘贴区：输入 / 粘贴后自动转换
  richBox?.addEventListener('input', scheduleConvert);
  richBox?.addEventListener('paste', () => scheduleConvert());
  richBox?.addEventListener('blur', () => void convert());
  // 富文本区为空时清掉浏览器可能残留的 <br>
  richBox?.addEventListener('input', () => {
    if (richBox.innerHTML === '<br>') richBox.innerHTML = '';
  });

  htmlBox?.addEventListener('input', scheduleConvert);

  srcSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
    if (!btn) return;
    setSrcMode((btn.dataset.value as SrcMode) ?? 'rich');
  });

  runBtn?.addEventListener('click', () => void convert());

  // 上传 .html 文件：切到源码模式并填入
  uploadBtn?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', () => {
    const file = uploadInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (htmlBox) htmlBox.value = String(reader.result ?? '');
      setSrcMode('html');
      void convert();
      showImportNotice(`已导入 ${file.name}`, 'info');
    };
    reader.onerror = () => showImportNotice('读取文件失败，请重试', 'error');
    reader.readAsText(file);
    uploadInput.value = '';
  });

  clearImportBtn?.addEventListener('click', () => {
    if (richBox) richBox.innerHTML = '';
    if (htmlBox) htmlBox.value = '';
    if (outBox) outBox.value = '';
    if (outStatus) outStatus.textContent = '';
    lastMd = '';
    showImportNotice('已清空', 'info');
  });

  outCopy?.addEventListener('click', () => {
    if (!lastMd) {
      showImportNotice('还没有可复制的内容', 'warn');
      return;
    }
    navigator.clipboard
      .writeText(lastMd)
      .then(() => showImportNotice('Markdown 已复制到剪贴板', 'info'))
      .catch(() => showImportNotice('复制失败，请改用「下载 .md」', 'warn'));
  });

  outDownload?.addEventListener('click', () => {
    if (!lastMd) {
      showImportNotice('还没有可下载的内容', 'warn');
      return;
    }
    const title = guessHtmlTitle(sourceHtml());
    downloadBlob(new Blob([lastMd], { type: 'text/markdown;charset=utf-8' }), `${sanitizeName(title)}.md`);
  });

  outToEditor?.addEventListener('click', () => {
    if (!lastMd) {
      showImportNotice('还没有可送入的内容', 'warn');
      return;
    }
    input.value = lastMd;
    schedule();
    void render();
    setMode('edit');
    showNotice('已送入编辑器，可继续编辑', 'info');
  });

  // ================= 初始化 =================
  let initial = '';
  try {
    initial = localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    initial = '';
  }
  input.value = initial || SAMPLE;
  updateStatus();
  void render();
  setMode('edit');
}
