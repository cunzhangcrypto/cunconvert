import { ConvertError } from '../utils/errors';
import type { CropRect } from '../converters/types';

export interface RasterJobOpts {
  outputType: 'png' | 'jpg' | 'webp';
  quality?: number;
  background?: string | null;
  width?: number;
  height?: number;
  scale?: number;
  lockRatio?: boolean;
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  crop?: CropRect;
}

export interface RasterJobOut {
  buf: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
}

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

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (v: RasterJobOut) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/image.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (ev: MessageEvent<WorkerOk | WorkerErr>) => {
      const msg = ev.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.out);
      else p.reject(new ConvertError(msg.error || '图片处理失败'));
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'Worker 异常'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function canUseWorker(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  );
}

/** 在 Web Worker 中执行位图解码/缩放/裁剪/旋转/翻转/编码 */
export function runRasterJob(buf: ArrayBuffer, mime: string, opts: RasterJobOpts): Promise<RasterJobOut> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const w = getWorker();
    const msg: WorkerReq = { id, buf, mime, opts };
    w.postMessage(msg, [buf]);
  });
}
