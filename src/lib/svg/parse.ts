import { ConvertError } from '../utils/errors';

export interface SvgInfo {
  width?: number;
  height?: number;
  viewBox?: string;
}

function parseXml(text: string): Document | null {
  try {
    return new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch {
    return null;
  }
}

function parseLen(v: string | null): number | undefined {
  if (!v) return undefined;
  const m = v.trim().match(/^([0-9.]+)(?:px)?$/i);
  return m ? Math.round(parseFloat(m[1])) : undefined;
}

/** 解析 SVG 文本，提取 width/height/viewBox 信息 */
export function getSvgInfo(text: string): SvgInfo {
  const info: SvgInfo = {};
  const doc = parseXml(text);
  if (!doc || doc.documentElement?.tagName.toLowerCase() !== 'svg') return info;

  const svg = doc.documentElement;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    info.viewBox = vb;
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      if (!info.width) info.width = Math.round(parts[2]);
      if (!info.height) info.height = Math.round(parts[3]);
    }
  }
  const w = parseLen(svg.getAttribute('width'));
  const h = parseLen(svg.getAttribute('height'));
  if (w) info.width = w;
  if (h) info.height = h;
  return info;
}

/** 给 SVG 补上明确尺寸（用于位图渲染），返回序列化后的完整 SVG 文本 */
export function buildRenderableSvg(
  text: string,
  opts: { width?: number; height?: number },
): string {
  const doc = parseXml(text);
  if (!doc || doc.documentElement?.tagName.toLowerCase() !== 'svg') {
    throw new ConvertError('无法解析该 SVG 文件');
  }
  const svg = doc.documentElement;
  if (opts.width) svg.setAttribute('width', String(opts.width));
  if (opts.height) svg.setAttribute('height', String(opts.height));
  return new XMLSerializer().serializeToString(svg);
}
