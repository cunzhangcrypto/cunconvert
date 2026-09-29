/**
 * 站点 URL 工具。
 * 正式域名通过构建环境变量 SITE_URL 提供（Vercel / Cloudflare Pages 均可配置），
 * 代码中不写死任何占位域名。未配置时返回空串，相关 canonical/OG 标签自动省略。
 */
export function canonicalUrl(path: string): string {
  const site = import.meta.env.SITE as string | undefined;
  if (!site) return '';
  try {
    return new URL(path, site).href;
  } catch {
    return '';
  }
}
