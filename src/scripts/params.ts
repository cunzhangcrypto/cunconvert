/** 参数面板的读取与交互辅助 */

export type Params = Record<string, unknown>;

/** 读取参数面板当前值（seg 取激活项 data-value，输入取 value/checked） */
export function readParams(scope: HTMLElement): Params {
  const out: Params = {};
  scope.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => {
    const key = el.getAttribute('data-param');
    if (!key) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') out[key] = el.checked;
      else if (el.type === 'color') out[key] = el.value;
      else if (el.type === 'range') out[key] = Number(el.value);
      else if (el.type === 'number') out[key] = el.value === '' ? NaN : Number(el.value);
      else out[key] = el.value;
    } else if (el instanceof HTMLSelectElement) {
      out[key] = el.value;
    } else if (el.classList.contains('seg')) {
      const active = el.querySelector<HTMLButtonElement>('button.active[data-value]');
      if (active) out[key] = active.getAttribute('data-value') ?? '';
    }
  });
  return out;
}

/** 为所有 seg 绑定点击切换激活态 */
export function initSegs(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('.seg[data-param]').forEach((seg) => {
    seg.querySelectorAll<HTMLButtonElement>('button[data-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  });
}

/** 监听某个 seg 的切换回调（value 为 data-value） */
export function bindSeg(scope: HTMLElement, key: string, cb: (value: string) => void): void {
  const seg = scope.querySelector<HTMLElement>(`.seg[data-param="${key}"]`);
  if (!seg) return;
  seg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
    if (btn) cb(btn.getAttribute('data-value') ?? '');
  });
}

/** 让 range 滑块右侧的 .hint 实时显示当前值 */
export function initRangeHints(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLInputElement>('input[type="range"][data-param]').forEach((range) => {
    const block = range.closest<HTMLElement>('.param-block');
    const hint = block?.querySelector<HTMLElement>('.hint');
    const update = () => {
      if (hint) hint.textContent = range.value;
    };
    range.addEventListener('input', update);
    update();
  });
}

/** "原始/自定义"尺寸控件：切换时显示/隐藏自定义输入 */
export function initSizeFields(scope: HTMLElement): void {
  const fields = scope.querySelector<HTMLElement>('[data-size-fields]');
  const width = scope.querySelector<HTMLInputElement>('input[data-param="width"]');
  const height = scope.querySelector<HTMLInputElement>('input[data-param="height"]');
  const lock = scope.querySelector<HTMLInputElement>('input[data-param="lock"]');
  bindSeg(scope, 'size-mode', (v) => {
    if (fields) fields.style.display = v === 'custom' ? '' : 'none';
  });
  // 锁定比例时：修改一边，清空另一边，由引擎按比例计算
  if (width && lock) {
    width.addEventListener('input', () => {
      if (lock.checked && width.value && height) height.value = '';
    });
  }
  if (height && lock) {
    height.addEventListener('input', () => {
      if (lock.checked && height.value && width) width.value = '';
    });
  }
}

export function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** 解析背景参数：transparent -> null；white/black/custom -> 颜色值 */
export function resolveBackgroundParam(
  p: Params,
  allowTransparent = true,
): string | null {
  const bg = p.background;
  if (bg === 'transparent' || bg == null || bg === '') {
    return allowTransparent ? null : '#ffffff';
  }
  if (bg === 'white') return '#ffffff';
  if (bg === 'black') return '#000000';
  if (bg === 'custom') {
    const c = typeof p['background-color'] === 'string' ? p['background-color'] : '#ffffff';
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : '#ffffff';
  }
  return null;
}
