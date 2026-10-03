import { ConvertError } from '../utils/errors';
import type JSZipType from 'jszip';

let cached: Promise<typeof JSZipType> | null = null;

function loadJszip(): Promise<typeof JSZipType> {
  if (!cached) {
    cached = import('jszip')
      .then((m) => m.default)
      .catch(() => {
        throw new ConvertError('ZIP 打包引擎加载失败，请刷新页面后重试');
      });
  }
  return cached;
}

/** 将多个 {name, blob} 打包为一个 ZIP Blob（全部在浏览器本地完成） */
export async function zipBlobs(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<Blob> {
  if (files.length === 0) throw new ConvertError('暂无可打包的文件');
  const JSZip = await loadJszip();
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}
