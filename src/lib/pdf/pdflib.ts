import { ConvertError } from '../utils/errors';

export type PdfLib = typeof import('pdf-lib');

let cached: Promise<PdfLib> | null = null;

/** 按需加载 pdf-lib（仅 PDF 相关工具用到，不进首屏） */
export async function loadPdfLib(): Promise<PdfLib> {
  if (!cached) {
    cached = import('pdf-lib').catch((e) => {
      cached = null;
      throw e instanceof ConvertError ? e : new ConvertError('PDF 引擎加载失败，请刷新页面后重试');
    });
  }
  return cached;
}

/** 把 pdf-lib 的载入异常翻译成面向用户的中文提示 */
export function describeLoadError(name: string, e: unknown): ConvertError {
  const msg = String((e as Error)?.message ?? '');
  if (/encrypt/i.test(msg)) return new ConvertError(`「${name}」已加密，需要密码才能处理`);
  return new ConvertError(`无法读取「${name}」，文件可能已损坏或不是有效的 PDF`);
}
