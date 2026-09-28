import { ConvertError } from '../utils/errors';

function parseXml(text: string): Document | null {
  try {
    return new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch {
    return null;
  }
}

/** 是否指向外部资源（http/https/协议相对） */
function isExternal(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith('http:') ||
    v.startsWith('https:') ||
    v.startsWith('//') ||
    v.startsWith('javascript:')
  );
}

/**
 * SVG 安全清洗：
 * 移除 script / iframe / object / embed / foreignObject、所有 on* 事件属性、
 * 指向外部资源的 href/xlink:href/src、引用外部资源或非内联 data 图片的 <image>。
 * 用于将任意上传的 SVG 渲染到位图前，防止恶意内容。
 */
export function sanitizeSvg(text: string): string {
  const doc = parseXml(text);
  if (!doc || doc.documentElement?.tagName.toLowerCase() !== 'svg') {
    throw new ConvertError('无法解析该 SVG 文件');
  }

  const walk = (node: Element): void => {
    const tag = node.tagName.toLowerCase();
    if (
      tag === 'script' ||
      tag === 'iframe' ||
      tag === 'object' ||
      tag === 'embed' ||
      tag === 'foreignobject'
    ) {
      node.remove();
      return;
    }

    for (const attr of [...node.attributes]) {
      if (attr.name.toLowerCase().startsWith('on')) {
        node.removeAttribute(attr.name);
        continue;
      }
      const lower = attr.name.toLowerCase();
      if (lower === 'href' || lower === 'xlink:href' || lower === 'src') {
        if (isExternal(attr.value)) {
          node.removeAttribute(attr.name);
        }
      }
    }

    if (tag === 'image') {
      const src =
        node.getAttribute('href') ??
        node.getAttribute('xlink:href') ??
        node.getAttribute('src') ??
        '';
      const s = src.trim().toLowerCase();
      // 仅保留 data: 内联图片，其余外部图片移除（浏览器渲染 <img> 时本就不加载外链）
      if (!s.startsWith('data:') || isExternal(src)) {
        node.remove();
        return;
      }
    }

    for (const child of [...node.children]) {
      walk(child as Element);
    }
  };

  walk(doc.documentElement);
  return new XMLSerializer().serializeToString(doc.documentElement);
}
