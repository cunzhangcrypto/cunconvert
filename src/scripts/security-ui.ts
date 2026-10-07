/** 安全工具共用的交互辅助（复制 / 提示 / 按钮反馈） */

/** 复制文本到剪贴板；非安全上下文（无 clipboard API）时退回到 execCommand */
export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e instanceof Error ? e : new Error('复制失败'));
    } finally {
      ta.remove();
    }
  });
}

/** 在 root 内的 [data-notice] 显示提示条 */
export function showNotice(root: HTMLElement, msg: string, kind: 'info' | 'warn' | 'error' = 'error'): void {
  const notice = root.querySelector<HTMLElement>('[data-notice]');
  if (!notice) return;
  notice.innerHTML = '';
  if (!msg) return;
  const div = document.createElement('div');
  div.className = `notice ${kind}`;
  div.textContent = msg;
  notice.appendChild(div);
}

/** 按钮短暂显示「已复制」后恢复 */
export function flashButton(btn: HTMLButtonElement, label = '已复制'): void {
  if (btn.dataset.flashing === '1') return;
  const origin = btn.textContent ?? '';
  btn.dataset.flashing = '1';
  btn.textContent = label;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = origin;
    btn.disabled = false;
    delete btn.dataset.flashing;
  }, 1500);
}
