import type { ToolGuide } from './types';
import { svgGuides } from './svg';
import { convertGuides } from './convert';
import { imageGuides } from './image';
import { vectorGuides } from './vector';

export const guides: Record<string, ToolGuide> = {
  ...svgGuides,
  ...convertGuides,
  ...imageGuides,
  ...vectorGuides,
};

export function getGuide(slug: string): ToolGuide | undefined {
  return guides[slug];
}
