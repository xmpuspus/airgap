export type KBCategory = string;

export interface KBDocument {
  id: string;
  category: KBCategory;
  title: string;
  content: string;
  keywords: string[];
  tags: string[];
  metadata?: Record<string, unknown>;
}
