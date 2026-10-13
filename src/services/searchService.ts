import type {KBCategory, KBDocument} from '../types/knowledge';
import {getSearchIndex, getAllDocuments, getDocumentById} from '../knowledge';
import {config} from '../config/loader';

// Read at call time so a template or a test can change the depth after load.
function defaultTopK(): number {
  return config.knowledge.search?.topK ?? 3;
}

// Negation patterns: extract the negated term
const NEGATION_PATTERNS = [
  /\bnot?\s+(\w+)/gi,
  /\bdon'?t\s+want\s+(\w+)/gi,
  /\bwithout\s+(\w+)/gi,
  /\bexcept\s+(\w+)/gi,
  /\bexclude\s+(\w+)/gi,
  /\bnot\s+interested\s+in\s+(\w+)/gi,
];

// A customer who writes "no signal" reports a problem. Treating "signal" as an
// exclusion would drop the troubleshooting records that answer it.
const SYMPTOM_PHRASE =
  /^(?:no\s+(?:signal|internet|service|connection)|not\s+(?:working|loading|connecting))$/i;

/**
 * Extract negated terms from a query.
 * "I don't want postpaid" -> ['postpaid']
 */
export function extractNegatedTerms(query: string): string[] {
  const negated: string[] = [];
  for (const pattern of NEGATION_PATTERNS) {
    for (const match of query.matchAll(pattern)) {
      if (match[1] && !SYMPTOM_PHRASE.test(match[0])) {
        negated.push(match[1].toLowerCase());
      }
    }
  }
  return [...new Set(negated)];
}

function stripNegations(query: string): string {
  let stripped = query;
  for (const pattern of NEGATION_PATTERNS) {
    stripped = stripped.replace(pattern, match => (SYMPTOM_PHRASE.test(match) ? match : ''));
  }
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Filter results by removing documents whose category, tags, or title
 * match any of the negated terms.
 */
function applyNegationFilter(results: KBDocument[], negatedTerms: string[]): KBDocument[] {
  if (negatedTerms.length === 0) return results;
  return results.filter(doc => {
    const docText = [doc.category, doc.title, ...(doc.tags || []), ...(doc.keywords || [])]
      .join(' ')
      .toLowerCase();
    return !negatedTerms.some(term => docText.includes(term));
  });
}

export function searchKB(query: string, options?: {topK?: number}): KBDocument[] {
  const topK = options?.topK ?? defaultTopK();

  // Strip negation phrases from the search query so MiniSearch focuses on what the user DOES want
  const negatedTerms = extractNegatedTerms(query);
  const searchQuery = negatedTerms.length > 0 ? stripNegations(query) : query;

  const results = getSearchIndex().search(searchQuery || query);

  let mapped: KBDocument[] = results.slice(0, topK * 2).map(result => {
    // Preserve the BM25 score on the metadata field so the safety layer
    // can compute a real confidence value instead of a static placeholder.
    const score = (result as unknown as {score?: number}).score;
    const metadata = {
      ...((result.metadata as Record<string, unknown> | undefined) ?? {}),
      ...(typeof score === 'number' ? {score} : {}),
    };
    return {
      id: result.id as string,
      category: result.category as KBCategory,
      title: result.title as string,
      content: result.content as string,
      keywords: getDocumentById(result.id as string)?.keywords ?? [],
      tags: result.tags as string[],
      metadata,
    };
  });

  mapped = applyNegationFilter(mapped, negatedTerms);
  mapped = applyCategoryBoost(mapped, query);
  mapped = reRankResults(mapped, query);

  return mapped.slice(0, topK);
}

// Category intent detection — map query keywords to expected categories
const CATEGORY_SIGNALS: {keywords: string[]; category: KBCategory}[] = [
  {
    keywords: ['plan', 'plans', 'prepaid', 'postpaid', 'promo', 'pricing', 'surf', 'giga'],
    category: 'plan',
  },
  {keywords: ['store', 'branch', 'location', 'nearest', 'address'], category: 'store'},
  {keywords: ['roaming', 'abroad', 'travel', 'international'], category: 'roaming'},
  {
    keywords: ['troubleshoot', 'fix', 'not working', 'no signal', 'slow', 'restart'],
    category: 'troubleshooting',
  },
  {keywords: ['pay', 'payment', 'bill', 'gcash', 'bank'], category: 'payment'},
];

// Whole-word match, so "airplane" does not signal "plan".
function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

/**
 * Boost results whose category matches the detected query intent.
 * Moves matching-category results to the front without dropping others.
 */
function applyCategoryBoost(results: KBDocument[], query: string): KBDocument[] {
  const lower = query.toLowerCase();
  for (const signal of CATEGORY_SIGNALS) {
    if (signal.keywords.some(kw => hasWord(lower, kw))) {
      const matching = results.filter(r => r.category === signal.category);
      const rest = results.filter(r => r.category !== signal.category);
      if (matching.length > 0) {
        return [...matching, ...rest];
      }
    }
  }
  return results;
}

// Keyword-to-sort mapping for re-ranking
const PRICE_ASC_KEYWORDS = [
  'cheapest',
  'most affordable',
  'budget',
  'lowest price',
  'least expensive',
  'cheap',
];
const PRICE_DESC_KEYWORDS = ['most expensive', 'premium', 'highest price', 'top tier'];
const SPEED_DESC_KEYWORDS = ['fastest', 'highest speed', 'most speed', 'best speed'];

// Records without a value sort last in either direction.
function sortByValue(
  results: KBDocument[],
  getValue: (doc: KBDocument) => number | null,
  direction: 'asc' | 'desc',
): KBDocument[] {
  return [...results].sort((a, b) => {
    const valueA = getValue(a);
    const valueB = getValue(b);
    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    return direction === 'asc' ? valueA - valueB : valueB - valueA;
  });
}

function reRankResults(results: KBDocument[], query: string): KBDocument[] {
  if (results.length <= 1) return results;
  const lower = query.toLowerCase();

  if (PRICE_ASC_KEYWORDS.some(kw => lower.includes(kw))) {
    return sortByValue(results, doc => getNumericMeta(doc, 'price'), 'asc');
  }
  if (PRICE_DESC_KEYWORDS.some(kw => lower.includes(kw))) {
    return sortByValue(results, doc => getNumericMeta(doc, 'price'), 'desc');
  }
  if (SPEED_DESC_KEYWORDS.some(kw => lower.includes(kw))) {
    return sortByValue(results, parseSpeed, 'desc');
  }

  return results;
}

function getNumericMeta(doc: KBDocument, field: string): number | null {
  const val = doc.metadata?.[field];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseSpeed(doc: KBDocument): number | null {
  const speed = doc.metadata?.speed;
  if (typeof speed === 'number') return speed;
  if (typeof speed === 'string') {
    // Extract numeric part from "100 Mbps", "50Mbps" etc.
    const match = speed.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  return null;
}

export function getDocById(id: string): KBDocument | undefined {
  return getDocumentById(id);
}

function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rebuilt when the document list changes, for example after a knowledge sync.
let keywordDocs: KBDocument[] | null = null;
let keywordSet = new Set<string>();

/**
 * True when the whole query equals a keyword of some record. The follow-up
 * detector treats every short question as a follow-up, so a template-defined
 * keyword such as "sino ka" is the one signal that a short question is a new topic.
 */
export function matchesKnowledgeKeyword(query: string): boolean {
  const docs = getAllDocuments();
  if (docs !== keywordDocs) {
    keywordDocs = docs;
    keywordSet = new Set(docs.flatMap(doc => doc.keywords.map(normalizeKeyword)));
  }
  const normalized = normalizeKeyword(query);
  return normalized.length > 0 && keywordSet.has(normalized);
}
