import { ConvertError } from '../utils/errors';

type SvgoModule = typeof import('svgo/browser');

let cached: SvgoModule | null = null;

/** 按需加载 svgo/browser（仅优化器页面用到） */
export async function loadSvgo(): Promise<SvgoModule> {
  if (!cached) {
    try {
      cached = await import('svgo/browser');
    } catch {
      throw new ConvertError('SVG 优化引擎加载失败，请刷新页面后重试');
    }
  }
  return cached;
}

export interface SvgoRunOpts {
  /** 高级模式：多轮迭代优化 */
  multipass?: boolean;
  /** 是否保留 viewBox（高级模式下可关闭） */
  keepViewBox?: boolean;
}

/** 执行 SVG 优化，返回优化后的文本 */
export async function runSvgo(svg: string, opts: SvgoRunOpts = {}): Promise<string> {
  const { optimize } = await loadSvgo();
  // plugins 数组会整体替换默认预设，必须显式带上 preset-default，
  // 否则优化插件全部不运行，只会压掉空白字符。
  const plugins: unknown[] = ['preset-default'];
  // SVGO v4 的 preset-default 已不再包含 removeViewBox（viewBox 默认就保留），
  // 只有用户显式选择「不保留」时才额外挂上该插件。
  if (opts.keepViewBox === false) plugins.push('removeViewBox');
  const result = optimize(svg, {
    multipass: opts.multipass ?? false,
    plugins: plugins as never[],
  });
  if (!result.data) throw new ConvertError('SVG 优化失败');
  return result.data;
}
