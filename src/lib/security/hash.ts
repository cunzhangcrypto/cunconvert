import { toHex } from './encode';

export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1' | 'MD5';

/** 推荐用于安全场景的算法 */
export const RECOMMENDED_ALGOS: HashAlgorithm[] = ['SHA-256', 'SHA-384', 'SHA-512'];
/** 仅建议用于兼容旧系统 / 文件校验的算法 */
export const LEGACY_ALGOS: HashAlgorithm[] = ['SHA-1', 'MD5'];

export const DEFAULT_ALGO: HashAlgorithm = 'SHA-256';

export function isLegacyAlgo(algo: HashAlgorithm): boolean {
  return LEGACY_ALGOS.includes(algo);
}

/** 计算字节 Hash。SHA 系列走 Web Crypto，MD5 走本地纯 JS 实现 */
export async function hashBytes(data: ArrayBuffer, algo: HashAlgorithm): Promise<string> {
  if (algo === 'MD5') return md5Hex(new Uint8Array(data));
  const buf = await crypto.subtle.digest(algo, data);
  return toHex(new Uint8Array(buf));
}

/** 计算文本 Hash（UTF-8 编码） */
export async function hashText(text: string, algo: HashAlgorithm): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buf).set(encoded);
  return hashBytes(buf, algo);
}

/** 计算文件 Hash —— 读取完全在浏览器本地完成，文件不会上传 */
export async function hashFile(file: File, algo: HashAlgorithm): Promise<string> {
  return hashBytes(await file.arrayBuffer(), algo);
}

// ===================== 纯 JavaScript MD5（本地实现） =====================

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/** K 表：floor(abs(sin(i + 1)) * 2^32) */
const MD5_K = (() => {
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  return k;
})();

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

/**
 * MD5（RFC 1321）纯 JS 实现。
 * 浏览器 Web Crypto 不提供 MD5，这里完全在本地计算，绝不上传数据。
 */
export function md5Hex(input: Uint8Array): string {
  const len = input.length;
  const withOne = len + 1;
  const padLen = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + padLen + 8;
  const msg = new Uint8Array(total);
  msg.set(input, 0);
  msg[len] = 0x80;

  // 原始字节长度的 bit 数，按小端 64 位写入末尾
  const bitLenLo = (len << 3) >>> 0;
  const bitLenHi = Math.floor(len / 0x20000000) >>> 0;
  msg[total - 8] = bitLenLo & 0xff;
  msg[total - 7] = (bitLenLo >>> 8) & 0xff;
  msg[total - 6] = (bitLenLo >>> 16) & 0xff;
  msg[total - 5] = (bitLenLo >>> 24) & 0xff;
  msg[total - 4] = bitLenHi & 0xff;
  msg[total - 3] = (bitLenHi >>> 8) & 0xff;
  msg[total - 2] = (bitLenHi >>> 16) & 0xff;
  msg[total - 1] = (bitLenHi >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const m = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      m[i] = (msg[j]! | (msg[j + 1]! << 8) | (msg[j + 2]! << 16) | (msg[j + 3]! << 24)) >>> 0;
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + MD5_K[i]! + m[g]!) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, MD5_S[i]!)) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let i = 0; i < 4; i++) {
    const w = words[i]!;
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return toHex(out);
}
