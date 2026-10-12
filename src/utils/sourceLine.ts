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

// The answer card shows the publisher and checked date of each cited record, so
// the bubble drops the same "Source: <url> (checked <date>)." sentence instead
// of wrapping a long link mid-word. A link that no cited record carries stays.
export function stripSourceSentences(text: string, urls: string[]): string {
  let shown = text;
  for (const url of urls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    shown = shown.replace(
      new RegExp(
        `[ \\t]*Source:\\s*${escaped}(?:\\s*\\(checked \\d{4}-\\d{2}-\\d{2}\\))?\\.?`,
        'g',
      ),
      '',
    );
  }
  return shown.replace(/[ \t]+$/gm, '').trim();
}

export function ensureSourceLine(answer: string, doc: KBDocument | undefined): string {
  const line = sourceLineFor(doc);
  if (!line) return answer;
  const source = doc?.metadata?.source as string;
  return answer.includes(source) ? answer : `${answer.trim()}\n\n${line}`;
}
