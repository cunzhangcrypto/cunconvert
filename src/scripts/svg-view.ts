import { getSvgInfo, type SvgInfo } from '../lib/svg/parse';
import { toUserMessage, formatBytes } from '../lib/utils/errors';
import { downloadBlob } from '../lib/utils/file';

/** SVG 查看器：预览 + 尺寸/viewBox 信息 + 复制代码 + 下载原文件 */
export function mount(root: HTMLElement): void {
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const input = root.querySelector<HTMLInputElement>('[data-file-input]');
  const browse = root.querySelector<HTMLElement>('[data-browse]');
  const info = root.querySelector<HTMLElement>('[data-svg-info]');
  const actions = root.querySelector<HTMLElement>('.actions');
  const progress = root.querySelector<HTMLElement>('[data-progress]');
  const results = root.querySelector<HTMLElement>('[data-result-list]');
  if (actions) actions.hidden = true;
  if (progress) progress.hidden = true;
  if (results) results.hidden = true;

  let currentUrl = '';

  const notice = (msg: string, kind: 'info' | 'warn' | 'error' = 'error') => {
    const box = root.querySelector<HTMLElement>('[data-notice]');
    if (!box) return;
    box.innerHTML = '';
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    box.appendChild(div);
  };

  async function handleFile(file: File): Promise<void> {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    notice('');
    try {
      const text = await file.text();
      const svgInfo = getSvgInfo(text);
      if (!svgInfo.width && !svgInfo.height && !svgInfo.viewBox) {
        throw new Error('无法解析该 SVG 文件');
      }
      currentUrl = URL.createObjectURL(file);
      render(file, text, svgInfo, currentUrl);
    } catch (e) {
      notice(toUserMessage(e));
      if (info) info.innerHTML = '';
    }
  }

  function render(file: File, text: string, svgInfo: SvgInfo, url: string): void {
    if (!info) return;
    const size = formatBytes(file.size);
    const dims =
      svgInfo.width && svgInfo.height
        ? `${svgInfo.width} × ${svgInfo.height} px`
        : svgInfo.viewBox
          ? '由 viewBox 决定'
          : '未知';

    const rows: [string, string][] = [
      ['文件名', file.name],
      ['文件大小', size],
      ['宽度', svgInfo.width ? `${svgInfo.width} px` : '—'],
      ['高度', svgInfo.height ? `${svgInfo.height} px` : '—'],
      ['viewBox', svgInfo.viewBox ?? '—'],
    ];

    info.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'preview-panel';

    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';
    const ph = document.createElement('h4');
    ph.textContent = '预览';
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    previewBox.append(ph, img);

    const infoBox = document.createElement('div');
    infoBox.className = 'preview-box';
    const ih = document.createElement('h4');
    ih.textContent = '文件信息';
    infoBox.appendChild(ih);
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.className = 'svg-info-row';
      const kEl = document.createElement('span');
      kEl.className = 'svg-info-key';
      kEl.textContent = k;
      const vEl = document.createElement('span');
      vEl.className = 'svg-info-val';
      vEl.textContent = v;
      row.append(kEl, vEl);
      infoBox.appendChild(row);
    }
    const btnRow = document.createElement('div');
    btnRow.className = 'actions';
    btnRow.style.marginTop = '14px';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-secondary';
    copyBtn.textContent = '复制 SVG';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard
        .writeText(text)
        .then(() => notice('SVG 代码已复制到剪贴板', 'info'))
        .catch(() => notice('复制失败，请手动选择代码复制', 'warn'));
    });

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn-primary';
    dlBtn.textContent = '下载原文件';
    dlBtn.addEventListener('click', () => downloadBlob(file, file.name));

    btnRow.append(copyBtn, dlBtn);
    infoBox.appendChild(btnRow);

    panel.append(previewBox, infoBox);
    info.appendChild(panel);
    void dims;
  }

  browse?.addEventListener('click', (e) => {
    e.stopPropagation();
    input?.click();
  });
  dropzone?.addEventListener('click', () => input?.click());
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  });
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void handleFile(file);
    input.value = '';
  });
}
