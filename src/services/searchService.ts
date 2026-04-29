import type {KBCategory, KBDocument} from '../types/knowledge';
import {getSearchIndex, getAllDocuments, getDocumentById} from '../knowledge';
import {config} from '../config/loader';
import {logger} from './logger';

const DEFAULT_TOP_K = config.knowledge.search?.topK ?? 3;

// Negation patterns: extract the negated term
const NEGATION_PATTERNS = [
  /\bnot?\s+(\w+)/i,
  /\bdon'?t\s+want\s+(\w+)/i,
  /\bwithout\s+(\w+)/i,
  /\bexcept\s+(\w+)/i,
  /\bno\s+(\w+)/i,
  /\bexclude\s+(\w+)/i,
  /\bnot\s+interested\s+in\s+(\w+)/i,
];

/**
 * Extract negated terms from a query.
 * "I don't want postpaid" -> ['postpaid']
 */
export function extractNegatedTerms(query: string): string[] {
  const negated: string[] = [];
  for (const pattern of NEGATION_PATTERNS) {
    const match = query.match(pattern);
    if (match && match[1]) {
      negated.push(match[1].toLowerCase());
    }
  }
  return [...new Set(negated)];
}

/**
 * Filter results by removing documents whose category, tags, or title
 * match any of the negated terms.
 */
function applyNegationFilter(
  results: KBDocument[],
  negatedTerms: string[],
): KBDocument[] {
  if (negatedTerms.length === 0) return results;
  return results.filter(doc => {
    const docText = [
      doc.category,
      doc.title,
      ...(doc.tags || []),
      ...(doc.keywords || []),
    ]
      .join(' ')
      .toLowerCase();
    return !negatedTerms.some(term => docText.includes(term));
  });
}

export function searchKB(
  query: string,
  options?: {category?: KBCategory; topK?: number},
): KBDocument[] {
  const topK = options?.topK ?? DEFAULT_TOP_K;

  const category = options?.category;

  // Strip negation phrases from the search query so MiniSearch focuses on what the user DOES want
  let searchQuery = query;
  const negatedTerms = extractNegatedTerms(query);
  if (negatedTerms.length > 0) {
    logger.debug('searchService', 'Negated terms detected', {negatedTerms});
    // Remove negation phrases to improve search precision
    for (const pattern of NEGATION_PATTERNS) {
      searchQuery = searchQuery.replace(pattern, '');
    }
    searchQuery = searchQuery.replace(/\s+/g, ' ').trim();
  }

  const results = getSearchIndex().search(searchQuery || query, {
    filter: category
      ? result => (result as unknown as {category: string}).category === category
      : undefined,
  });

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

  // Apply negation filter
  mapped = applyNegationFilter(mapped, negatedTerms);

  // Boost results whose category matches the query intent
  mapped = applyCategoryBoost(mapped, query);

  // Re-rank based on query intent (price/speed sorting)
  mapped = reRankResults(mapped, query);

  return mapped.slice(0, topK);
}

// Category intent detection — map query keywords to expected categories
const CATEGORY_SIGNALS: {keywords: string[]; category: KBCategory}[] = [
  {keywords: ['plan', 'plans', 'prepaid', 'postpaid', 'promo', 'pricing', 'surf', 'giga'], category: 'plan'},
  {keywords: ['store', 'branch', 'location', 'nearest', 'address'], category: 'store'},
  {keywords: ['roaming', 'abroad', 'travel', 'international'], category: 'roaming'},
  {keywords: ['troubleshoot', 'fix', 'not working', 'no signal', 'slow', 'restart'], category: 'troubleshooting'},
  {keywords: ['pay', 'payment', 'bill', 'gcash', 'bank'], category: 'payment'},
];

/**
 * Boost results whose category matches the detected query intent.
 * Moves matching-category results to the front without dropping others.
 */
function applyCategoryBoost(results: KBDocument[], query: string): KBDocument[] {
  const lower = query.toLowerCase();
  for (const signal of CATEGORY_SIGNALS) {
    if (signal.keywords.some(kw => lower.includes(kw))) {
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
  'cheapest', 'most affordable', 'budget', 'lowest price',
  'least expensive', 'cheap',
];
const PRICE_DESC_KEYWORDS = [
  'most expensive', 'premium', 'highest price', 'top tier',
];
const SPEED_DESC_KEYWORDS = [
  'fastest', 'highest speed', 'most speed', 'best speed',
];

function reRankResults(results: KBDocument[], query: string): KBDocument[] {
  if (results.length <= 1) return results;
  const lower = query.toLowerCase();

  // Price-ascending sort for "cheapest"/"budget" queries
  if (PRICE_ASC_KEYWORDS.some(kw => lower.includes(kw))) {
    return [...results].sort((a, b) => {
      const priceA = getNumericMeta(a, 'price');
      const priceB = getNumericMeta(b, 'price');
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return 1;
      return priceA - priceB;
    });
  }

  // Price-descending sort
  if (PRICE_DESC_KEYWORDS.some(kw => lower.includes(kw))) {
    return [...results].sort((a, b) => {
      const priceA = getNumericMeta(a, 'price');
      const priceB = getNumericMeta(b, 'price');
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return 1;
      return priceB - priceA;
    });
  }

  // Speed-descending sort for "fastest" queries
  if (SPEED_DESC_KEYWORDS.some(kw => lower.includes(kw))) {
    return [...results].sort((a, b) => {
      const speedA = parseSpeed(a);
      const speedB = parseSpeed(b);
      if (speedA === null && speedB === null) return 0;
      if (speedA === null) return 1;
      if (speedB === null) return 1;
      return speedB - speedA;
    });
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

export function getAllByCategory(category: KBCategory): KBDocument[] {
  return getAllDocuments().filter(doc => doc.category === category);
}
