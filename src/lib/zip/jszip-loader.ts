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

/**
 * 让 ZIP 内的条目名互不重复。
 *
 * ⚠️ `zip.file(name, blob)` 对**同名条目是替换**，不是并存 ——
 * 直接把结果名丢进去，重名的文件会被**静默丢掉**（实测 2 个结果只进 1 个）。
 * 而重名在真实使用里很常见：不同目录下各有一个 `photo.png`；
 * 或 `photo.png` + `photo.jpg` 一起转成同一目标格式；
 * `remove-background` 更是无条件输出 `.png`，只要基名相同就必撞。
 *
 * 冲突时在扩展名前追加 `-2` / `-3`…，并**对着已用集合循环**，
 * 免得生成出的 `-2` 又和输入里本就存在的 `photo-2.png` 撞上。
 */
function uniqueEntryNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    let candidate = `${base}-${i}${ext}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${base}-${i}${ext}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/** 将多个 {name, blob} 打包为一个 ZIP Blob（全部在浏览器本地完成） */
export async function zipBlobs(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<Blob> {
  if (files.length === 0) throw new ConvertError('暂无可打包的文件');
  const JSZip = await loadJszip();
  const zip = new JSZip();
  const names = uniqueEntryNames(files.map((f) => f.name));
  files.forEach((f, i) => {
    zip.file(names[i], f.blob);
  });
  return zip.generateAsync({ type: 'blob' });
}
