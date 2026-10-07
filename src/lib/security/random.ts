/**
 * 密码学安全随机工具。
 *
 * 统一使用 crypto.getRandomValues()，绝不使用 Math.random()，
 * 保证生成的密码 / 密钥具有密码学安全随机性。全部在浏览器本地完成。
 */

/** [0, max) 区间内均匀分布的随机整数（拒绝采样，避免取模偏差） */
export function randomInt(max: number): number {
  if (max <= 0) throw new Error('max 必须大于 0');
  if (max === 1) return 0;
  // 2^32 内能整除 max 的最大区间；落在其外的样本丢弃后重取，保证均匀分布。
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0]!;
  } while (v >= limit);
  return v % max;
}

/** 从字符集中安全随机抽取一个字符 */
export function randomChar(charset: string): string {
  return charset.charAt(randomInt(charset.length));
}

/** 生成指定字节数的安全随机字节 */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/** Fisher–Yates 洗牌，随机源同样来自 crypto.getRandomValues */
export function secureShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
