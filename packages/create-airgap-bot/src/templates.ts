// Known industry templates shipped in the Airgap repo under examples/<template>/.
// Keep this list sorted and identical to the directory names in examples/.
export const TEMPLATES = [
  'airline',
  'banking',
  'electric-utility',
  'healthcare',
  'insurance',
  'telco',
  'water-utility',
] as const;

export type Template = (typeof TEMPLATES)[number];

export function isTemplate(value: string): value is Template {
  return (TEMPLATES as readonly string[]).includes(value);
}

// Friendly labels used by the interactive prompt. Order matches TEMPLATES.
export const TEMPLATE_LABELS: Record<Template, string> = {
  airline: 'Airline customer support',
  banking: 'Retail banking support',
  'electric-utility': 'Electric utility support',
  healthcare: 'Healthcare patient support',
  insurance: 'Insurance claims and policies',
  telco: 'Telecommunications support',
  'water-utility': 'Water utility support',
};
