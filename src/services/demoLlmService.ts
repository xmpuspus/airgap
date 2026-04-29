// Demo formatter. Streams a deterministic reply built from KB content with
// no model and no network. Drives `llm.mode: "demo"`. Vertical-agnostic.

import type {KBDocument} from '../types/knowledge';
import {logger} from './logger';
import type {LlmRunStats} from './llmService';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Structured doc shape for streamFromKb. Keeps the formatter decoupled
// from buildUserMessage's literal layout.
type DocLike = Pick<KBDocument, 'category' | 'title' | 'content'>;

// Pulls the REFERENCE INFORMATION block out of a buildUserMessage payload.
// Only used when the orchestrator routes through routeGeneration; the
// preferred entry point is streamFromKb, which takes structured docs.
export function extractReferenceBlock(userMessage: string): string | null {
  const match = userMessage.match(
    /REFERENCE INFORMATION:\s*\n+([\s\S]*?)(?:\n\nCONVERSATION SO FAR:|\n\nBased ONLY on)/,
  );
  if (!match) return null;
  const block = match[1].trim();
  if (!block || /^No relevant information/i.test(block)) return null;
  return block;
}

// Renders a list of KB docs as the bot reply. Bolds each title, keeps
// content as-is, no category tag (the chip row already shows it).
export function renderDocs(docs: DocLike[]): string {
  const parts: string[] = [];
  for (const doc of docs) {
    const title = doc.title.trim();
    const content = doc.content.trim();
    if (content) parts.push(`**${title}**\n${content}`);
    else if (title) parts.push(`**${title}**`);
  }
  return parts.join('\n\n');
}

// Back-compat path: parses the [CATEGORY] Title format that buildUserMessage
// emits. Kept so routeGeneration's text-in / text-out signature still works.
// The orchestrator should prefer streamFromKb for new code.
export function formatReferenceAsReply(block: string): string {
  const docHeaderRe = /(^|\n\n+)(\[[A-Z_]+\]\s+[^\n]*)/g;
  const headers: Array<{titleStart: number; titleEnd: number}> = [];
  for (const m of block.matchAll(docHeaderRe)) {
    const start = (m.index ?? 0) + m[1].length;
    headers.push({titleStart: start, titleEnd: start + m[2].length});
  }
  if (headers.length === 0) return block.trim();

  const docs: DocLike[] = headers.map((h, i) => {
    const nextStart =
      i + 1 < headers.length ? headers[i + 1].titleStart : block.length;
    const headerLine = block.slice(h.titleStart, h.titleEnd).trim();
    const headerMatch = headerLine.match(/^\[([A-Z_]+)\]\s*(.*)$/);
    return {
      category: headerMatch ? headerMatch[1] : 'unknown',
      title: headerMatch ? headerMatch[2].trim() : headerLine,
      content: block.slice(h.titleEnd, nextStart).trim(),
    };
  });
  return renderDocs(docs);
}

const NO_KB_FALLBACK =
  "I don't have that in my knowledge base. Try rephrasing or asking about one of the suggestions on the home screen.";

// Per-chunk delay range. Chunks are word-sized fragments produced by the
// regex split below; they are NOT LLM tokens. Naming kept deliberately
// distinct from llmService's tokenCount to avoid the comparison.
const MIN_CHUNK_DELAY_MS = 20;
const CHUNK_DELAY_JITTER_MS = 30;

class DemoLlmService {
  private generating = false;
  private lastFirstTokenMs: number | null = null;
  private lastTotalMs: number | null = null;
  private lastTokenCount: number | null = null;

  // Mirrors llmService.getLastRunStats() so the bench harness can read
  // both paths uniformly. tokenCount here counts streamed chunks, not
  // LLM tokens; the BenchResult Notes column flags this.
  getLastRunStats(): LlmRunStats {
    return {
      loadMs: 0,
      firstTokenMs: this.lastFirstTokenMs,
      totalMs: this.lastTotalMs,
      tokenCount: this.lastTokenCount,
    };
  }

  // Preferred path: structured docs in, streamed text out. Pass the
  // top-K KBDocuments straight from searchKB, no string round-trip.
  async streamFromKb(
    docs: DocLike[],
    onChunk?: (chunk: string) => void,
    onFirstChunk?: () => void,
  ): Promise<string> {
    return this.run(renderDocs(docs) || NO_KB_FALLBACK, onChunk, onFirstChunk);
  }

  // Back-compat: routeGeneration calls this with the buildUserMessage
  // payload. Parses the REFERENCE INFORMATION block back out.
  async generate(
    _systemPrompt: string,
    userMessage: string,
    onChunk?: (chunk: string) => void,
    onFirstChunk?: () => void,
  ): Promise<string> {
    const block = extractReferenceBlock(userMessage);
    const text = block ? formatReferenceAsReply(block) : NO_KB_FALLBACK;
    return this.run(text, onChunk, onFirstChunk);
  }

  private async run(
    text: string,
    onChunk?: (chunk: string) => void,
    onFirstChunk?: () => void,
  ): Promise<string> {
    if (this.generating) {
      throw new Error('demo generation already in progress');
    }
    this.generating = true;
    const startTime = Date.now();
    this.lastFirstTokenMs = null;
    this.lastTotalMs = null;
    this.lastTokenCount = 0;

    try {
      logger.info('demoLlm', 'streaming reply', {length: text.length});

      const chunks = text.split(/(?<=\s)|(?=\n)/);
      if (onChunk) {
        let firedFirst = false;
        for (const chunk of chunks) {
          if (!firedFirst) {
            firedFirst = true;
            this.lastFirstTokenMs = Date.now() - startTime;
            try {
              onFirstChunk?.();
            } catch (err) {
              logger.warn('demoLlm', 'onFirstChunk callback threw', {err: String(err)});
            }
          }
          this.lastTokenCount = (this.lastTokenCount ?? 0) + 1;
          onChunk(chunk);
          await sleep(MIN_CHUNK_DELAY_MS + Math.random() * CHUNK_DELAY_JITTER_MS);
        }
      } else {
        this.lastTokenCount = chunks.length;
      }

      this.lastTotalMs = Date.now() - startTime;
      return text;
    } finally {
      this.generating = false;
    }
  }
}

export const demoLlmService = new DemoLlmService();
