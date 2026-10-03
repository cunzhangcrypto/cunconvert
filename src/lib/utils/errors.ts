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
      case 'NotReadableError':
        // 常见于：文件被移动/删除、仍在同步中（OneDrive 等按需下载的占位文件）、
        // 或所在磁盘被拔出 —— 浏览器拿不到内容。
        return '无法读取文件内容，请确认文件仍在原位置（若在云盘同步目录中，请先下载到本地）后重试。';
      case 'NotFoundError':
        return '找不到该文件，可能已被移动或删除，请重新选择。';
      case 'EncodingError':
        return '文件编码异常，可能已损坏，请换一个文件重试。';
      case 'QuotaExceededError':
        return '浏览器存储空间不足，请关闭部分标签页后重试。';
    }
  }
  if (e instanceof Error && /memory|alloc|heap/i.test(e.message)) {
    return '内存不足，请尝试处理较小的图片。';
  }
  if (e instanceof Error && /encoding|codec|decode|paint/i.test(e.message)) {
    return '图片解码失败，文件可能已损坏或格式不受支持。';
  }
  // ⚠️ 走到这里说明是「未预期的错误」。必须把原始错误打出来 ——
  // 否则线上只能看到一句兜底文案，连是哪个文件、什么原因都无从查起
  // （2026-10-03 就因此排查了很久：真实原因是后缀与真实格式不符，
  //  pdf-lib 抛了普通 Error 被这里吞掉）。
  console.error('[cunconvert] 未预期的错误：', e);
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
