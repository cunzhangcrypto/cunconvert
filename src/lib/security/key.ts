import { randomBytes } from './random';
import { encodeBytes, type KeyFormat } from './encode';

export type { KeyFormat };

export interface KeySize {
  bits: number;
  bytes: number;
}

export const KEY_SIZES: KeySize[] = [
  { bits: 128, bytes: 16 },
  { bits: 192, bytes: 24 },
  { bits: 256, bytes: 32 },
  { bits: 512, bytes: 64 },
];

export const DEFAULT_KEY_BITS = 256;

export function keySize(bits: number): KeySize {
  return KEY_SIZES.find((s) => s.bits === bits) ?? { bits, bytes: Math.ceil(bits / 8) };
}

/** 生成随机密钥：bits 位随机数，按指定格式编码 */
export function generateKey(bits: number, format: KeyFormat): string {
  const bytes = Math.ceil(bits / 8);
  return encodeBytes(randomBytes(bytes), format);
}
