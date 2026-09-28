export interface GuideSection {
  h2: string;
  paragraphs: string[];
  list?: string[];
}

export interface ToolGuide {
  slug: string;
  lead: string;
  sections: GuideSection[];
  faq: { q: string; a: string }[];
}
