import { initSegs, bindSeg, readParams } from './params';
import { generateKey, keySize, type KeyFormat } from '../lib/security/key';
import { copyText, showNotice, flashButton } from './security-ui';

const FORMATS: KeyFormat[] = ['hex', 'base64', 'base64url'];

/** 随机密钥生成器：面向开发者，随机数来自 crypto.getRandomValues */
export function mount(root: HTMLElement): void {
  initSegs(root);

  const outputEl = root.querySelector<HTMLElement>('[data-kg-output]');
  const meta = root.querySelector<HTMLElement>('[data-kg-meta]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-kg-copy]');
  const genBtn = root.querySelector<HTMLButtonElement>('[data-kg-generate]');
  if (!outputEl) return;
  const output: HTMLElement = outputEl;

  let current = '';

  function readFormat(): KeyFormat {
    const v = String(readParams(root)['kg-format'] ?? 'hex');
    return (FORMATS as string[]).includes(v) ? (v as KeyFormat) : 'hex';
  }

  function readBits(): number {
    return Number(readParams(root)['kg-bits']) || 256;
  }

  function render(): void {
    const bits = readBits();
    current = generateKey(bits, readFormat());
    output.textContent = current;
    output.classList.remove('placeholder');
    if (copyBtn) copyBtn.hidden = false;
    if (meta) {
      const s = keySize(bits);
      meta.textContent = `${s.bits} bit = ${s.bytes} bytes`;
    }
    showNotice(root, '');
  }

  bindSeg(root, 'kg-format', () => render());
  bindSeg(root, 'kg-bits', () => render());
  genBtn?.addEventListener('click', () => render());

  copyBtn?.addEventListener('click', () => {
    if (!current) return;
    copyText(current)
      .then(() => flashButton(copyBtn))
      .catch(() => showNotice(root, '复制失败，请手动选中后复制', 'warn'));
  });

  render();
}
