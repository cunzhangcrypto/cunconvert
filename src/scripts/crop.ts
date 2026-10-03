import { initConvertTool, type ConvertOutput } from './convert-ui';
import { initSegs, bindSeg, num, readParams, type Params } from './params';
import { cropImage } from '../lib/converters/crop';
import { decodeToImage } from '../lib/image/decode';
import { replaceExt } from '../lib/utils/file';
import { toUserMessage } from '../lib/utils/errors';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropState {
  nw: number;
  nh: number;
  dispW: number;
  dispH: number;
  rect: Rect;
  ratio: string;
}

const RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

/** 图片裁剪：画布选区 + 比例锁定 + 旋转 */
export function mount(root: HTMLElement): void {
  const wrap = root.querySelector<HTMLElement>('[data-crop-wrap]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-crop-canvas]');
  const stage = root.querySelector<HTMLElement>('[data-crop-stage]');
  if (!wrap || !canvas || !stage) return;

  initSegs(root);

  // ---- 裁剪选区状态 ----
  let state: CropState | null = null;
  /** 解码后的原图，旋转/翻转时用它重绘预览 */
  let srcImg: HTMLImageElement | null = null;
  /**
   * 当前的旋转 / 翻转。**预览与导出共用同一套变换**，所以是「先旋转再裁剪」：
   * 用户在旋转后的画面上拖裁剪框，导出时把框映射回原图坐标交给引擎。
   */
  let rotate: 0 | 90 | 180 | 270 = 0;
  let flipH = false;
  let flipV = false;
  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  const handles = ['nw', 'ne', 'sw', 'se'].map((h) => {
    const d = document.createElement('div');
    d.className = 'crop-handle';
    d.dataset.handle = h;
    overlay.appendChild(d);
    return d;
  });
  wrap.appendChild(overlay);

  function fitRect(ratio: number | null, preferW?: number): Rect {
    const { dispW, dispH } = state!;
    let w = preferW ?? Math.round(dispW * 0.8);
    let h = ratio ? Math.round(w / ratio) : Math.round(dispH * 0.8);
    if (h > dispH) {
      h = dispH;
      w = ratio ? Math.round(h * ratio) : w;
    }
    if (w > dispW) {
      w = dispW;
      h = ratio ? Math.round(w / ratio) : h;
    }
    if (w < 10) w = 10;
    if (h < 10) h = 10;
    return { x: Math.round((dispW - w) / 2), y: Math.round((dispH - h) / 2), w, h };
  }

  function drawOverlay(): void {
    if (!state) return;
    const r = state.rect;
    overlay.style.left = `${r.x}px`;
    overlay.style.top = `${r.y}px`;
    overlay.style.width = `${r.w}px`;
    overlay.style.height = `${r.h}px`;
  }

  function setRatio(value: string): void {
    if (!state) return;
    state.ratio = value;
    const ratio = RATIOS[value] ?? null;
    if (ratio) {
      const center = { x: state.rect.x + state.rect.w / 2, y: state.rect.y + state.rect.h / 2 };
      let w = state.rect.w;
      let h = Math.round(w / ratio);
      if (h > state.dispH) {
        h = state.dispH;
        w = Math.round(h * ratio);
      }
      state.rect = {
        x: Math.max(0, Math.min(state.dispW - w, Math.round(center.x - w / 2))),
        y: Math.max(0, Math.min(state.dispH - h, Math.round(center.y - h / 2))),
        w,
        h,
      };
      drawOverlay();
    }
  }

  // ---- 指针交互 ----
  let drag: {
    mode: 'move' | 'resize';
    handle?: string;
    startX: number;
    startY: number;
    startRect: Rect;
  } | null = null;

  function localPos(e: PointerEvent): { x: number; y: number } {
    const r = wrap!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitHandle(x: number, y: number): string | null {
    for (const h of handles) {
      const r = h.getBoundingClientRect();
      const hx = r.left + r.width / 2;
      const hy = r.top + r.height / 2;
      const wr = wrap!.getBoundingClientRect();
      if (Math.hypot(x - (hx - wr.left), y - (hy - wr.top)) <= 12) return h.dataset.handle ?? null;
    }
    return null;
  }

  function clampRect(r: Rect, keepRatio: boolean): Rect {
    if (!state) return r;
    const { dispW, dispH } = state;
    const ratio = RATIOS[state.ratio] ?? null;
    const min = 10;
    let { x, y, w, h } = r;
    if (w < min) w = min;
    if (h < min) h = min;
    if (keepRatio && ratio) {
      if (w / h > ratio) h = Math.round(w / ratio);
      else w = Math.round(h * ratio);
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > dispW) x = dispW - w;
    if (y + h > dispH) y = dispH - h;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    return { x, y, w, h };
  }

  wrap.addEventListener('pointerdown', (e) => {
    if (!state || e.button !== 0) return;
    const { x, y } = localPos(e);
    const handle = hitHandle(x, y);
    const r = state.rect;
    if (handle) {
      drag = { mode: 'resize', handle, startX: x, startY: y, startRect: { ...r } };
    } else if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      drag = { mode: 'move', startX: x, startY: y, startRect: { ...r } };
    } else {
      return;
    }
    wrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!drag || !state) return;
    const { x, y } = localPos(e);
    const s = drag.startRect;
    const ratio = RATIOS[state.ratio] ?? null;

    if (drag.mode === 'move') {
      const nx = s.x + (x - drag.startX);
      const ny = s.y + (y - drag.startY);
      state.rect = clampRect({ x: nx, y: ny, w: s.w, h: s.h }, false);
    } else {
      const handle = drag.handle ?? 'se';
      let nx = s.x;
      let ny = s.y;
      let nw = s.w;
      let nh = s.h;
      if (handle.includes('e')) nw = s.w + (x - drag.startX);
      if (handle.includes('s')) nh = s.h + (y - drag.startY);
      if (handle.includes('w')) {
        nw = s.w - (x - drag.startX);
        nx = s.x + (x - drag.startX);
      }
      if (handle.includes('n')) {
        nh = s.h - (y - drag.startY);
        ny = s.y + (y - drag.startY);
      }
      if (ratio) {
        if (Math.abs(nw - s.w) >= Math.abs(nh - s.h)) {
          nh = Math.round(nw / ratio);
          ny = handle.includes('n') ? s.y + s.h - nh : s.y;
        } else {
          nw = Math.round(nh * ratio);
          nx = handle.includes('w') ? s.x + s.w - nw : s.x;
        }
      }
      state.rect = clampRect({ x: nx, y: ny, w: nw, h: nh }, Boolean(ratio));
    }
    drawOverlay();
  });

  const endDrag = () => {
    drag = null;
  };
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  // ---- 旋转 / 翻转 ----
  /** 旋转后画布的宽高（90°/270° 时宽高互换） */
  function rotatedDims(s: CropState): { tw: number; th: number } {
    const swap = rotate === 90 || rotate === 270;
    return { tw: swap ? s.nh : s.nw, th: swap ? s.nw : s.nh };
  }

  /** 按当前旋转/翻转重绘预览，并同步 dispW/dispH */
  function renderPreview(): void {
    if (!state || !srcImg) return;
    const s = state;
    const { tw, th } = rotatedDims(s);
    const scale = Math.min(760 / tw, 520 / th, 1);
    const sw = Math.max(1, Math.round(s.nw * scale));
    const sh = Math.max(1, Math.round(s.nh * scale));
    const swap = rotate === 90 || rotate === 270;
    s.dispW = swap ? sh : sw;
    s.dispH = swap ? sw : sh;
    canvas!.width = s.dispW;
    canvas!.height = s.dispH;
    const ctx = canvas!.getContext('2d');
    if (!ctx) throw new Error('无法创建绘图上下文');
    ctx.clearRect(0, 0, s.dispW, s.dispH);
    // 与 imageToCanvas / worker 完全相同的变换顺序：先翻转再旋转，最后平移到中心
    ctx.save();
    ctx.translate(s.dispW / 2, s.dispH / 2);
    if (rotate) ctx.rotate((rotate * Math.PI) / 180);
    if (flipH) ctx.scale(-1, 1);
    if (flipV) ctx.scale(1, -1);
    ctx.drawImage(srcImg, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  /**
   * 把「旋转/翻转后」图像上的一个点映射回**原图**坐标。
   * 引擎（convertRaster）的语义是「先按 crop 取原图区域，再旋转」，
   * 而界面语义是「先旋转，再裁剪」。两者等价当且仅当传给引擎的是
   * 选中区域在**原图**中的位置，所以这里必须做逆变换。
   */
  function transformedToOriginal(px: number, py: number): { x: number; y: number } {
    const s = state!;
    const { tw, th } = rotatedDims(s);
    const rx = px - tw / 2;
    const ry = py - th / 2;
    let fx: number;
    let fy: number;
    if (rotate === 90) {
      fx = ry;
      fy = -rx;
    } else if (rotate === 180) {
      fx = -rx;
      fy = -ry;
    } else if (rotate === 270) {
      fx = -ry;
      fy = rx;
    } else {
      fx = rx;
      fy = ry;
    }
    const cx = flipH ? -fx : fx;
    const cy = flipV ? -fy : fy;
    return { x: cx + s.nw / 2, y: cy + s.nh / 2 };
  }

  /** 从控件读当前变换值（不触发重绘） */
  function readTransform(): { rotate: 0 | 90 | 180 | 270; flipH: boolean; flipV: boolean } {
    const p = readParams(root);
    const r = num(p['crop-rotate']) ?? 0;
    const rr = r === 90 || r === 180 || r === 270 ? r : 0;
    return { rotate: rr, flipH: !!p['crop-flipH'], flipV: !!p['crop-flipV'] };
  }

  /** 变换改变后：重绘预览、重置裁剪框（宽高比变了，旧框已无意义） */
  function syncTransform(): void {
    const t = readTransform();
    if (t.rotate === rotate && t.flipH === flipH && t.flipV === flipV) return;
    rotate = t.rotate;
    flipH = t.flipH;
    flipV = t.flipV;
    if (!state || !srcImg) return;
    renderPreview();
    state.rect = fitRect(RATIOS[state.ratio] ?? null);
    drawOverlay();
  }

  // ---- 参数读取 ----
  function getParams(): Params {
    if (!state) return {};
    const s = state;
    // 1) 屏幕上的裁剪框 → 「旋转后」图像的像素坐标
    const { tw, th } = rotatedDims(s);
    const tx = (s.rect.x / s.dispW) * tw;
    const ty = (s.rect.y / s.dispH) * th;
    const tRectW = (s.rect.w / s.dispW) * tw;
    const tRectH = (s.rect.h / s.dispH) * th;
    // 2) 逆变换回原图坐标（引擎在原图空间裁剪）
    const a = transformedToOriginal(tx, ty);
    const b = transformedToOriginal(tx + tRectW, ty + tRectH);
    const ox = Math.max(0, Math.min(s.nw, Math.min(a.x, b.x)));
    const oy = Math.max(0, Math.min(s.nh, Math.min(a.y, b.y)));
    const ow = Math.max(1, Math.min(s.nw - ox, Math.abs(b.x - a.x)));
    const oh = Math.max(1, Math.min(s.nh - oy, Math.abs(b.y - a.y)));
    // 返回原图的比例值，多文件时各文件按自身尺寸换算
    return {
      cropFrac: { x: ox / s.nw, y: oy / s.nh, w: ow / s.nw, h: oh / s.nh },
      rotate,
      flipH,
      flipV,
    };
  }

  // ---- 首次选文件后载入画布 ----
  async function loadFirst(files: File[]): Promise<void> {
    const file = files.find((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!file) return;
    try {
      const img = await decodeToImage(file);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) throw new Error('无法读取图片尺寸');
      srcImg = img;
      const t = readTransform();
      rotate = t.rotate;
      flipH = t.flipH;
      flipV = t.flipV;
      const ratio = (readParams(root)['crop-ratio'] as string) || 'free';
      state = { nw, nh, dispW: nw, dispH: nh, rect: { x: 0, y: 0, w: nw, h: nh }, ratio };
      renderPreview();
      state.rect = fitRect(RATIOS[state.ratio] ?? null);
      stage!.hidden = false;
      drawOverlay();
    } catch (e) {
      const notice = root.querySelector<HTMLElement>('[data-notice]');
      if (notice) {
        notice.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'notice error';
        div.textContent = toUserMessage(e);
        notice.appendChild(div);
      }
    }
  }

  bindSeg(root, 'crop-ratio', setRatio);
  bindSeg(root, 'crop-rotate', syncTransform);
  for (const key of ['crop-flipH', 'crop-flipV']) {
    root
      .querySelector<HTMLInputElement>(`input[data-param="${key}"]`)
      ?.addEventListener('change', syncTransform);
  }

  // ---- 转换 ----
  initConvertTool(root, {
    onFiles: (files) => void loadFirst(files),
    getParams,
    async convert(file, p): Promise<ConvertOutput> {
      const f = p.cropFrac as { x: number; y: number; w: number; h: number } | undefined;
      if (!f) throw new Error('请先设置裁剪区域');
      const img = await decodeToImage(file);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const crop = {
        x: Math.round(f.x * nw),
        y: Math.round(f.y * nh),
        w: Math.round(f.w * nw),
        h: Math.round(f.h * nh),
      };
      if (crop.w < 1 || crop.h < 1) throw new Error('裁剪区域无效，请重新选择');
      const res = await cropImage(file, {
        crop,
        rotate: (num(p.rotate) ?? 0) as 0 | 90 | 180 | 270,
        flipH: !!p.flipH,
        flipV: !!p.flipV,
      });
      return {
        blob: res.blob,
        name: replaceExt(file.name, res.ext),
        width: res.meta.width,
        height: res.meta.height,
        savedPercent: res.meta.savedPercent,
      };
    },
  });
}
