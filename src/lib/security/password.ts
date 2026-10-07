import { randomChar, secureShuffle } from './random';

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** 排除容易混淆的字符：0 O o 1 I l */
  excludeAmbiguous: boolean;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~';
/** 容易看错的字符（数字 0/O/o、数字 1/I/l） */
const AMBIGUOUS = '0Oo1Il';

/** 按需剔除容易混淆的字符 */
function prune(set: string, excludeAmbiguous: boolean): string {
  if (!excludeAmbiguous) return set;
  return set
    .split('')
    .filter((c) => !AMBIGUOUS.includes(c))
    .join('');
}

/** 当前配置下实际可用的字符集（用于计算强度） */
export function passwordCharset(opts: PasswordOptions): string {
  const sets: string[] = [];
  if (opts.uppercase) sets.push(prune(UPPER, opts.excludeAmbiguous));
  if (opts.lowercase) sets.push(prune(LOWER, opts.excludeAmbiguous));
  if (opts.digits) sets.push(prune(DIGITS, opts.excludeAmbiguous));
  if (opts.symbols) sets.push(prune(SYMBOLS, opts.excludeAmbiguous));
  return sets.join('');
}

export interface PasswordResult {
  value: string;
  /** 字符集大小 */
  charsetSize: number;
  /** 估算熵（bit），仅用于强度分级 */
  entropy: number;
}

/**
 * 生成随机密码：
 * 先从每个已选字符集各取一个（保证每类字符都出现），
 * 再用合并字符集补足长度，最后整体洗牌打散位置。
 */
export function generatePassword(opts: PasswordOptions): PasswordResult {
  const sets: string[] = [];
  if (opts.uppercase) sets.push(prune(UPPER, opts.excludeAmbiguous));
  if (opts.lowercase) sets.push(prune(LOWER, opts.excludeAmbiguous));
  if (opts.digits) sets.push(prune(DIGITS, opts.excludeAmbiguous));
  if (opts.symbols) sets.push(prune(SYMBOLS, opts.excludeAmbiguous));

  const pool = sets.filter((s) => s.length > 0).join('');
  if (!pool) return { value: '', charsetSize: 0, entropy: 0 };

  const len = Math.max(1, Math.floor(opts.length));
  const chars: string[] = [];
  for (const s of sets) {
    if (s.length > 0 && chars.length < len) chars.push(randomChar(s));
  }
  while (chars.length < len) chars.push(randomChar(pool));
  const value = secureShuffle(chars).slice(0, len).join('');
  const entropy = len * Math.log2(pool.length);
  return { value, charsetSize: pool.length, entropy };
}

export type StrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface Strength {
  level: StrengthLevel;
  label: string;
  /** 0–100，用于进度条宽度 */
  percent: number;
}

/** 依据长度与字符集规模做简单强度分级，不做「破解时间」估算 */
export function passwordStrength(entropy: number, charsetSize: number): Strength {
  if (charsetSize === 0) return { level: 'weak', label: '弱', percent: 5 };
  if (entropy < 45) return { level: 'weak', label: '弱', percent: 25 };
  if (entropy < 70) return { level: 'medium', label: '中等', percent: 50 };
  if (entropy < 100) return { level: 'strong', label: '强', percent: 78 };
  return { level: 'very-strong', label: '很强', percent: 100 };
}
