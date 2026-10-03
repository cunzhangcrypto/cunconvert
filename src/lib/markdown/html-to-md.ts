import { ConvertError } from '../utils/errors';

interface TurndownInstance {
  use: (plugin: unknown) => TurndownInstance;
  remove: (filter: string | string[]) => TurndownInstance;
  turndown: (html: string) => string;
}

interface TurndownCtor {
  new (opts?: unknown): TurndownInstance;
}

interface Engines {
  TurndownService: TurndownCtor;
  gfm: unknown;
}

let cached: Promise<Engines> | null = null;

/** 按需加载 turndown + GFM 插件（仅 Markdown 页面用到） */
async function loadEngines(): Promise<Engines> {
  if (!cached) {
    cached = Promise.all([import('turndown'), import('turndown-plugin-gfm')])
      .then(([td, gfmMod]) => {
        const TurndownService =
          (td as { default?: TurndownCtor }).default ?? (td as unknown as TurndownCtor);
        const mod = gfmMod as { gfm?: unknown; default?: { gfm?: unknown } };
        const gfm = mod.gfm ?? mod.default?.gfm;
        if (!TurndownService) throw new Error('turndown missing');
        return { TurndownService, gfm };
      })
      .catch((e) => {
        cached = null;
        throw e instanceof ConvertError ? e : new ConvertError('HTML 转换引擎加载失败，请刷新页面后重试');
      });
  }
  return cached;
}

/**
 * HTML -> Markdown（支持 GFM：表格、删除线、任务列表）。
 * 用户粘贴的文章可能带样式与脚本，这里先剔除这些标签，
 * 避免把 CSS/JS 混进 Markdown 结果。
 */
export async function htmlToMarkdown(html: string): Promise<string> {
  const src = (html ?? '').trim();
  if (!src) throw new ConvertError('请先输入或粘贴 HTML 内容');

  const { TurndownService, gfm } = await loadEngines();

  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  if (gfm) service.use(gfm);
  // turndown 会把整段输入包进一个容器再解析，于是 <head> 里的 <title> 也会被
  // 当成正文输出（表现为开头多出一行纯文本标题）。这里连同 head 一起剔除。
  service.remove(['head', 'title', 'script', 'style', 'noscript', 'meta', 'link', 'iframe', 'base']);

  try {
    return service
      .turndown(src)
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    throw new ConvertError('无法解析该 HTML，请检查内容是否完整');
  }
}

/** 从 HTML 里猜一个标题，用作导出文件名 */
export function guessHtmlTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return 'document';
  const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text || 'document';
}
