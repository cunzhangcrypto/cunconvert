/** 统一错误类型：所有可预期失败都抛 ConvertError，文案为中文 */
export class ConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConvertError';
  }
}

/** 将任意异常映射为面向用户的中文提示 */
export function toUserMessage(e: unknown): string {
  if (e instanceof ConvertError) return e.message;
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'AbortError':
        return '操作已取消。';
      case 'SecurityError':
        return '浏览器安全策略阻止了本次操作。';
      case 'NotSupportedError':
        return '当前浏览器不支持该功能，请更换较新的浏览器。';
      case 'InvalidStateError':
        return '文件状态无效，请重新选择文件。';
    }
  }
  if (e instanceof Error && /memory|alloc|heap/i.test(e.message)) {
    return '内存不足，请尝试处理较小的图片。';
  }
  if (e instanceof Error && /encoding|codec|decode|paint/i.test(e.message)) {
    return '图片解码失败，文件可能已损坏或格式不受支持。';
  }
  return '处理失败，请重试。如果问题持续出现，请尝试更换浏览器。';
}

/** 把字节数格式化为人类可读的字符串 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}
