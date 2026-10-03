/** slug -> 工具脚本 的动态加载映射（重型库仅在实际使用时加载） */

export interface ToolModule {
  mount(root: HTMLElement): void;
}

const map: Record<string, () => Promise<ToolModule>> = {
  'svg-to-png': () => import('./svg-convert'),
  'svg-to-jpg': () => import('./svg-convert'),
  'svg-to-webp': () => import('./svg-convert'),
  'png-to-jpg': () => import('./format-convert'),
  'png-to-webp': () => import('./format-convert'),
  'jpg-to-png': () => import('./format-convert'),
  'jpg-to-webp': () => import('./format-convert'),
  'webp-to-png': () => import('./format-convert'),
  'webp-to-jpg': () => import('./format-convert'),
  'image-compressor': () => import('./compress'),
  'image-resizer': () => import('./resize'),
  'image-cropper': () => import('./crop'),
  'image-rotate-flip': () => import('./rotate'),
  'remove-background': () => import('./remove-bg'),
  'svg-optimizer': () => import('./svg-optimize'),
  'svg-viewer': () => import('./svg-view'),
  'png-to-svg': () => import('./vectorize'),
  'jpg-to-svg': () => import('./vectorize'),
  'webp-to-svg': () => import('./vectorize'),
  'image-to-pdf': () => import('./image-to-pdf'),
  'pdf-to-image': () => import('./pdf-to-image'),
  'pdf-merge': () => import('./pdf-merge'),
  'pdf-split': () => import('./pdf-split'),
  'pdf-organize': () => import('./pdf-organize'),
  'qr-generator': () => import('./qr-generator'),
  'favicon-generator': () => import('./favicon-generator'),
  'markdown-editor': () => import('./markdown-editor'),
};

export async function mountTool(root: HTMLElement, slug: string): Promise<void> {
  const load = map[slug];
  if (!load) return;
  const mod = await load();
  mod.mount(root);
}
