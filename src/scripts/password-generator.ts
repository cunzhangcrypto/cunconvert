import { initSegs, bindSeg, readParams, num } from './params';
import { generatePassword, passwordStrength, type PasswordOptions } from '../lib/security/password';
import { copyText, showNotice, flashButton } from './security-ui';

/** 密码生成器：全部本地生成，随机数来自 crypto.getRandomValues */
export function mount(root: HTMLElement): void {
  initSegs(root);

  const outputEl = root.querySelector<HTMLElement>('[data-pw-output]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-pw-copy]');
  const genBtn = root.querySelector<HTMLButtonElement>('[data-pw-generate]');
  const customRow = root.querySelector<HTMLElement>('[data-pw-custom]');
  const strengthBox = root.querySelector<HTMLElement>('[data-pw-strength]');
  const strengthBar = root.querySelector<HTMLElement>('[data-pw-strength] .sec-strength-bar i');
  const strengthLabel = root.querySelector<HTMLElement>('[data-pw-strength-label]');
  if (!outputEl) return;
  const output: HTMLElement = outputEl;

  let current = '';

  function readOpts(): PasswordOptions {
    const p = readParams(root);
    const raw = String(p['pw-length'] ?? '20');
    const length =
      raw === 'custom'
        ? Math.min(128, Math.max(8, Math.round(num(p['pw-custom']) ?? 20)))
        : Number(raw) || 20;
    return {
      length,
      uppercase: p['pw-upper'] !== false,
      lowercase: p['pw-lower'] !== false,
      digits: p['pw-digit'] !== false,
      symbols: p['pw-symbol'] !== false,
      excludeAmbiguous: p['pw-noambiguous'] === true,
    };
  }

  function render(): void {
    const res = generatePassword(readOpts());
    current = res.value;

    if (!res.value) {
      output.textContent = '请至少选择一种字符类型';
      output.classList.add('placeholder');
      if (copyBtn) copyBtn.hidden = true;
      if (strengthBox) strengthBox.hidden = true;
      return;
    }

    output.textContent = res.value;
    output.classList.remove('placeholder');
    if (copyBtn) copyBtn.hidden = false;

    const s = passwordStrength(res.entropy, res.charsetSize);
    if (strengthBox) {
      strengthBox.hidden = false;
      strengthBox.dataset.level = s.level;
    }
    if (strengthBar) strengthBar.style.width = `${s.percent}%`;
    if (strengthLabel) strengthLabel.textContent = s.label;
    showNotice(root, '');
  }

  bindSeg(root, 'pw-length', (v) => {
    if (customRow) customRow.hidden = v !== 'custom';
    render();
  });

  // 复选框 / 自定义长度变化后即时重算
  root.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).closest('.seg')) return;
    render();
  });

  genBtn?.addEventListener('click', () => render());

  copyBtn?.addEventListener('click', () => {
    if (!current) return;
    copyText(current)
      .then(() => flashButton(copyBtn))
      .catch(() => showNotice(root, '复制失败，请手动选中后复制', 'warn'));
  });

  // 初始化：默认 20 位，隐藏自定义长度输入，先出一份密码
  if (customRow) customRow.hidden = true;
  render();
}
