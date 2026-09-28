/** 文件名与下载相关的工具函数 */

/** 替换文件扩展名，例如 a.png + 'jpg' -> a.jpg */
export function replaceExt(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

/** 从文件名提取扩展名（小写，不含点） */
export function extFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** 清理文件名中的非法字符 */
export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned || 'file';
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 计算节省百分比（可为负数，表示体积变大） */
export function calcSaved(originalSize: number, outputSize: number): number {
  if (!(originalSize > 0)) return 0;
  return Math.round((1 - outputSize / originalSize) * 100);
}
