import type {KBDocument} from '../types/knowledge';

// The source line is not the model's job. A record with metadata.source gets
// its line appended when the model text does not already carry it.
export function sourceLineFor(doc: KBDocument | undefined): string | null {
  const source = doc?.metadata?.source;
  if (typeof source !== 'string' || source.length === 0) return null;
  const asOf = doc?.metadata?.asOf;
  const checked = typeof asOf === 'string' && asOf.length > 0 ? ` (checked ${asOf})` : '';
  return `Source: ${source}${checked}.`;
}

export function ensureSourceLine(answer: string, doc: KBDocument | undefined): string {
  const line = sourceLineFor(doc);
  if (!line) return answer;
  const source = doc?.metadata?.source as string;
  return answer.includes(source) ? answer : `${answer.trim()}\n\n${line}`;
}
