import { ConvertError } from '../utils/errors';

interface Purify {
  sanitize: (dirty: string, config?: unknown) => string;
}

interface Engines {
  parse: (src: string, options?: unknown) => string | Promise<string>;
  purify: Purify;
}

let cached: Promise<Engines> | null = null;

/** 按需加载 marked + DOMPurify（仅 Markdown 页面用到） */
async function loadEngines(): Promise<Engines> {
  if (!cached) {
    cached = Promise.all([import('marked'), import('dompurify')])
      .then(([m, d]) => {
        const marked = m as unknown as { marked?: { parse: Engines['parse'] }; parse?: Engines['parse'] };
        const parse = marked.marked?.parse ?? marked.parse;
        const purify = (d as unknown as { default?: Purify }).default ?? (d as unknown as Purify);
        if (!parse) throw new Error('marked parse missing');
        return { parse, purify };
      })
      .catch((e) => {
        cached = null;
        throw e instanceof ConvertError ? e : new ConvertError('Markdown 解析引擎加载失败，请刷新页面后重试');
      });
  }
  return cached;
}

/**
 * Markdown -> 安全 HTML。
 * 用户内容可能含原始 HTML，渲染前必须经 DOMPurify 消毒，防止 XSS。
 */
export async function renderMarkdown(md: string): Promise<string> {
  const { parse, purify } = await loadEngines();
  const raw = (await parse(md, { async: false, gfm: true, breaks: true })) as string;
  return purify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: false,
  });
}

/** 把渲染结果包装成一个可直接打开的完整 HTML 文档 */
export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  const safeTitle = title.replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string,
  );
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  body { max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #1c1c1e; }
  h1, h2, h3, h4 { line-height: 1.3; }
  pre { background: #f6f7f8; padding: 14px; border-radius: 8px; overflow: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
  :not(pre) > code { background: #f1f1f2; padding: 2px 6px; border-radius: 4px; }
  blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #dcdcdd; color: #5a5a5c; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #e5e5e5; padding: 6px 12px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
