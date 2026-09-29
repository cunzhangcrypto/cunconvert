/**
 * 各工具 24px 线性图标（stroke 风格），供 ToolCard 与顶部"全部工具"下拉共用。
 */
export const toolIcons: Record<string, string> = {
  'svg-to-png': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.2"/><path d="M21 15.5l-4.5-4.5L9 17.5"/>',
  'svg-to-jpg': '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="9" cy="13" r="1.2"/><path d="M17.5 19l-4-4-3 3"/>',
  'svg-to-webp': '<rect x="3" y="3" width="14" height="14" rx="2"/><rect x="7" y="7" width="14" height="14" rx="2"/>',
  'svg-optimizer': '<path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
  'svg-viewer': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  'png-to-jpg': '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  'png-to-webp': '<path d="M8 7H3m0 0l3-3M3 7l3 3"/><path d="M16 17h5m0 0l-3-3m3 3l-3 3"/>',
  'jpg-to-png': '<path d="M19 12H5m0 0l6-6m-6 6l6 6"/>',
  'jpg-to-webp': '<path d="M5 12h14m0 0l-6-6m6 6l-6 6"/>',
  'webp-to-png': '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  'webp-to-jpg': '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>',
  'image-compressor': '<path d="M8 3v4H4"/><path d="M16 3v4h4"/><path d="M8 21v-4H4"/><path d="M16 21v-4h4"/>',
  'image-resizer': '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  'image-cropper': '<path d="M7 3v11a3 3 0 0 0 3 3h11"/><path d="M17 21V10a3 3 0 0 0-3-3H3"/>',
  'image-rotate-flip': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  'remove-background': '<path d="M3 21L21 3"/><path d="M8 16l3-3"/><path d="M12 12l3-3"/><path d="M15 9l1.5-1.5"/>',
  'png-to-svg': '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  'jpg-to-svg': '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  'webp-to-svg': '<path d="M3 17C3 11 9 9 12 9s9 2 9 8"/><circle cx="3" cy="17" r="1.4"/><circle cx="21" cy="17" r="1.4"/>',
};
