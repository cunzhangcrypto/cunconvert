/** 字节编码工具：Hex / Base64 / Base64URL —— 全部本地计算 */

export type KeyFormat = 'hex' | 'base64' | 'base64url';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  // 分块拼接，避免超大数组展开导致调用栈溢出
  const chunk = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Base64URL：把 +/ 换成 -_，并去掉尾部填充 = */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeBytes(bytes: Uint8Array, format: KeyFormat): string {
  if (format === 'base64') return toBase64(bytes);
  if (format === 'base64url') return toBase64Url(bytes);
  return toHex(bytes);
}
