import type { ToolGuide } from './types';
import { svgGuides } from './svg';
import { convertGuides } from './convert';
import { imageGuides } from './image';
import { vectorGuides } from './vector';
import { pdfGuides } from './pdf';
import { qrGuides } from './qr';
import { faviconGuides } from './favicon';
import { markdownGuides } from './markdown';
import { securityGuides } from './security';

export const guides: Record<string, ToolGuide> = {
  ...svgGuides,
  ...convertGuides,
  ...imageGuides,
  ...vectorGuides,
  ...pdfGuides,
  ...qrGuides,
  ...faviconGuides,
  ...markdownGuides,
  ...securityGuides,
};

export function getGuide(slug: string): ToolGuide | undefined {
  return guides[slug];
}
