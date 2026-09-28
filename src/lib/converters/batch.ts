/** 顺序批量处理 + 进度回调 */
export async function runBatch<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await fn(items[i], i);
    opts.onProgress?.(i + 1, items.length);
  }
}
