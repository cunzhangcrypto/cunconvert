/** 图片处理 Web Worker：解码 -> 变换 -> 编码，全部离线完成，结果以 transferable 返回 */
import { computeTargetSize } from '../lib/image/size';
import { assertCanvasSize } from '../lib/image/decode';
import type { RasterJobOpts, RasterJobOut } from '../lib/worker/pool';

interface WorkerReq {
  id: number;
  buf: ArrayBuffer;
  mime: string;
  opts: RasterJobOpts;
}
interface WorkerOk {
  id: number;
  ok: true;
  out: RasterJobOut;
}
interface WorkerErr {
  id: number;
  ok: false;
  error: string;
}

const MIME_OUT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

self.onmessage = async (ev: MessageEvent<WorkerReq>) => {
  const { id, buf, mime, opts } = ev.data;
  try {
    const blob = new Blob([buf], { type: mime });
    const bmp = await createImageBitmap(blob);

    const crop = opts.crop;
    const srcW = crop ? crop.w : bmp.width;
    const srcH = crop ? crop.h : bmp.height;
    const { width: tw, height: th } = computeTargetSize(srcW, srcH, opts);
    let outW = tw;
    let outH = th;
    if (opts.rotate === 90 || opts.rotate === 270) [outW, outH] = [outH, outW];
    assertCanvasSize(outW, outH);

    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建绘图上下文');

    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (opts.rotate) ctx.rotate((opts.rotate * Math.PI) / 180);
    if (opts.flipH) ctx.scale(-1, 1);
    if (opts.flipV) ctx.scale(1, -1);
    // ⚠️ 目标框用**未对调**的 tw/th，与主线程 imageToCanvas 保持一致。
    // 用对调后的 outW/outH 会把源矩形非等比拉伸：非正方形图旋转 90°/270°
    // 会被压进画布中间一半并左右溢出（2026-10-03 修复）。
    ctx.drawImage(bmp, crop?.x ?? 0, crop?.y ?? 0, srcW, srcH, -tw / 2, -th / 2, tw, th);
    ctx.restore();
    bmp.close?.();

    const mimeOut = MIME_OUT[opts.outputType] ?? 'image/png';
    const outBlob = await canvas.convertToBlob({ type: mimeOut, quality: opts.quality });
    const outBuf = await outBlob.arrayBuffer();
    const ok: WorkerOk = { id, ok: true, out: { buf: outBuf, mime: mimeOut, width: outW, height: outH } };
    (self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void }).postMessage(ok, [outBuf]);
  } catch (e) {
    const err: WorkerErr = { id, ok: false, error: e instanceof Error ? e.message : '图片处理失败' };
    self.postMessage(err);
  }
};
