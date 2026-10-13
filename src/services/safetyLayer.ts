/**
 * Safety layer: gates LLM output before it reaches the user.
 *
 * Responsibilities:
 *   1. Topic blocklist: refuse queries that match a configured blocked topic
 *      (e.g. medical/legal/financial advice, self-harm, politics) or a
 *      prompt probe. Anything not blocked goes on to retrieval.
 *   2. Confidence gate: refuse when the top retrieved record scores below
 *      `confidenceThreshold`. It applies only when a template sets the
 *      threshold above 0. The default of 0 passes any non-empty result.
 *   3. Grounding enforcement: reject answers that state a currency amount,
 *      a date, or a name that the retrieved records do not contain.
 *   4. Refusal templates: vertical-specific copy for the cases we
 *      intentionally do not answer (medical/legal/financial disclaimers).
 *
 * Refusals point the user to the hotline or in-person channels.
 *
 * All behavior is config-driven through `config.safety`. Disabling the entire
 * safety layer is a one-line change in airgap.config.json.
 */

import {checkInputPolicy} from '../core/publicService';
import type {KBDocument} from '../types/knowledge';
import {config, brand, interpolate} from '../config/loader';
import {t} from '../utils/i18n';
import {logger} from './logger';

export type RefusalReason =
  | 'blocked_topic'
  | 'low_confidence'
  | 'ungrounded_answer'
  | 'not_medical_advice'
  | 'not_financial_advice'
  | 'not_legal_advice'
  | 'prompt_probe'
  | 'no_commentary'
  | 'state_changing_offline';

export interface SafetyVerdict {
  allow: boolean;
  reason?: RefusalReason;
  refusalText?: string;
  issues: string[];
  confidence: number;
  retrievedDocIds: string[];
}

export interface SafetyConfig {
  enabled?: boolean;
  topicBlocklist?: string[];
  confidenceThreshold?: number;
  refusalTemplates?: Partial<Record<RefusalReason, string>>;
  groundingRules?: {
    requireCitations?: boolean;
    forbidUnsourcedAmounts?: boolean;
    forbidUnsourcedDates?: boolean;
    forbidUnsourcedNames?: boolean;
  };
}

export interface GroundingOptions {
  /** The user's question. Its words count as sourced, because a model echoes them. */
  question?: string;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0;
const DEFAULT_REFUSAL_TEMPLATES: Record<RefusalReason, string> = {
  blocked_topic:
    "I can't help with that topic. For concerns outside {{brandName}}'s support scope, please call {{hotline}}.",
  low_confidence:
    "I don't have reliable information on that. Please call {{hotline}} and a support specialist can help.",
  ungrounded_answer:
    "I can't confirm the specifics on that. For accurate details, please call {{hotline}}.",
  not_medical_advice:
    "I can't give medical advice. For medical concerns, please consult a licensed healthcare professional.",
  not_financial_advice:
    "I can't give investment or financial advice. For financial planning, please consult a licensed advisor.",
  not_legal_advice:
    "I can't give legal advice. For legal matters, please consult a licensed attorney.",
  prompt_probe:
    "I can't share my internal instructions or settings. I answer from {{brandName}}'s approved records. What can I help you with?",
  no_commentary:
    "I don't explain reasons, motives or allegations about people. I answer from {{brandName}}'s approved records.",
  state_changing_offline:
    "That action requires an internet connection. I've queued it and will process it when you're back online.",
};

function getSafetyConfig(): SafetyConfig {
  return (config as unknown as {safety?: SafetyConfig}).safety ?? {};
}

function isEnabled(): boolean {
  return getSafetyConfig().enabled !== false;
}

function getRefusalTemplate(reason: RefusalReason): string {
  // Resolution order:
  //   1. config.safety.refusalTemplates[reason]   (operator override)
  //   2. config.i18n.strings[`refusal.${reason}`] (locale-specific text)
  //   3. English default below
  const override = getSafetyConfig().refusalTemplates?.[reason];
  if (override) return interpolate(override, config);
  const tpl = t(`refusal.${reason}`, DEFAULT_REFUSAL_TEMPLATES[reason]);
  return interpolate(tpl, config);
}

/**
 * Pre-flight blocklist check. Runs BEFORE search or LLM generation.
 * Matches whole words/phrases to avoid false positives on substrings.
 */
export function checkBlocklist(query: string): {
  blocked: boolean;
  reason?: RefusalReason;
} {
  const reason = checkInputPolicy(query, getSafetyConfig()) as RefusalReason | undefined;
  if (reason) logger.info('safetyLayer', 'input policy refusal', {reason});
  return reason ? {blocked: true, reason} : {blocked: false};
}

/**
 * Confidence check: refuse when KB search returned nothing strong enough.
 *
 * Uses the BM25 score that searchService keeps on `metadata.score` of the top
 * retrieved doc and normalises it to the [0, 1] range via
 * score / (score + 1). This is monotonic in BM25: higher BM25
 * always yields higher normalised confidence, but it is bounded so callers can
 * compare against a fixed threshold without knowing the absolute BM25
 * scale of the corpus.
 *
 * If no docs were retrieved, or the top doc has no valid score, confidence is
 * 0 and the call fails closed. With the default threshold of 0 both still pass.
 */
export function checkConfidence(retrievedDocs: KBDocument[]): {
  confident: boolean;
  confidence: number;
} {
  if (!isEnabled()) {
    return {confident: true, confidence: 1};
  }
  const threshold = getSafetyConfig().confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  if (retrievedDocs.length === 0) {
    return {confident: false, confidence: 0};
  }
  const rawScore = (retrievedDocs[0].metadata as {score?: unknown} | undefined)?.score;
  const confidence =
    typeof rawScore === 'number' && Number.isFinite(rawScore) && rawScore >= 0
      ? rawScore / (rawScore + 1)
      : 0;
  return {confident: confidence >= threshold, confidence};
}

/**
 * Grounding enforcement.
 *
 * An answer is considered ungrounded if any of the following is true:
 *   - It mentions a currency amount not present in any retrieved doc
 *   - It mentions a specific date not present in any retrieved doc
 *   - It uses a capitalized name that no retrieved doc, the question, or the brand contains
 *
 * Purely textual, with no side effects.
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Full names and the usual short forms only, so "2 separate IDs" is not a date.
const MONTH_NAME =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?' +
  '|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
// 2026-04-15, 15/04/2026, April 15, Apr. 15, 2026, 15 April 2026
const DATE_RE = new RegExp(
  '\\b(?:(\\d{4})-(\\d{2})-(\\d{2})' +
    '|(\\d{1,2})/(\\d{1,2})/(\\d{2,4})' +
    `|(${MONTH_NAME})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?` +
    `|(\\d{1,2})\\s+(${MONTH_NAME})(?:,?\\s+(\\d{4}))?)\\b`,
  'gi',
);

interface DateParts {
  month: number;
  day: number;
  year: number | null;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

// A slash date keeps both the day-first and the month-first reading.
function parseDates(text: string): Array<{raw: string; readings: DateParts[]}> {
  const found: Array<{raw: string; readings: DateParts[]}> = [];
  for (const m of text.matchAll(DATE_RE)) {
    const readings: DateParts[] = [];
    if (m[1]) {
      readings.push({month: Number(m[2]), day: Number(m[3]), year: Number(m[1])});
    } else if (m[4]) {
      const year = m[6].length === 4 ? Number(m[6]) : null;
      readings.push({month: Number(m[4]), day: Number(m[5]), year});
      readings.push({month: Number(m[5]), day: Number(m[4]), year});
    } else if (m[7]) {
      readings.push({month: monthIndex(m[7]), day: Number(m[8]), year: m[9] ? Number(m[9]) : null});
    } else {
      readings.push({
        month: monthIndex(m[11]),
        day: Number(m[10]),
        year: m[12] ? Number(m[12]) : null,
      });
    }
    found.push({raw: m[0], readings});
  }
  return found;
}

function sameDate(a: DateParts, b: DateParts): boolean {
  if (a.month !== b.month || a.day !== b.day) return false;
  return a.year === null || b.year === null || a.year === b.year;
}

// Month and weekday names are capitalized in English and never a person.
const CALENDAR_WORDS = [
  ...MONTHS,
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'sept',
  'september',
  'october',
  'november',
  'december',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function wordKey(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// "Philippine" matches "Philippines" and "Marcos" matches "Marcos's" through
// a five-letter prefix. Short words must match whole.
function prefixKey(key: string): string {
  return key.length >= 5 ? key.slice(0, 5) : key;
}

function knownWordKeys(retrievedDocs: KBDocument[], question: string | undefined): Set<string> {
  const text = [
    ...retrievedDocs.map(d => `${d.title} ${d.content} ${(d.keywords ?? []).join(' ')}`),
    question ?? '',
    brand.name,
    brand.botName,
    ...CALENDAR_WORDS,
  ].join(' ');
  const keys = new Set<string>();
  for (const word of text.split(/[^\p{L}\p{N}'’.-]+/u)) {
    const key = wordKey(word);
    if (!key) continue;
    keys.add(key);
    keys.add(prefixKey(key));
  }
  return keys;
}

// A capitalized word inside a sentence that no retrieved record, the question,
// or the brand contains. "Joe Biden" from model memory fails here. A word at
// the start of a sentence or a line is skipped, because English capitalizes it.
function unsourcedNames(answer: string, known: Set<string>): string[] {
  const names: string[] = [];
  const candidate = /(^|[^\p{L}\p{N}])([A-Z][\p{L}\p{N}'’.-]*)/gu;
  for (const match of answer.matchAll(candidate)) {
    const word = match[2].replace(/[.'’-]+$/u, '');
    const before = answer.slice(0, (match.index ?? 0) + match[1].length);
    if (/(^|\n)\s*$/.test(before) || /[.!?:("'“‘\-–]\s*$/.test(before)) continue;
    // An all-caps token is an acronym or a code such as ID, PHP, or DICT.
    if (!/\p{Ll}/u.test(word)) continue;
    const key = wordKey(word);
    if (key.length < 2) continue;
    if (known.has(key) || known.has(prefixKey(key))) continue;
    names.push(word);
  }
  return names;
}

const NUMBER_RE = /\d+(?:\.\d+)?/g;

// What the retrieved records support. A token gate builds this once, because
// rebuilding it for every streamed word reads every record again each time.
interface GroundingSources {
  numbers: Set<number>;
  dates: DateParts[];
  known: Set<string>;
}

function groundingSources(
  retrievedDocs: KBDocument[],
  question: string | undefined,
): GroundingSources {
  const corpus = retrievedDocs
    .map(d => `${d.title}\n${d.content}`)
    .join('\n')
    .toLowerCase();
  return {
    numbers: new Set((corpus.match(NUMBER_RE) ?? []).map(Number)),
    dates: parseDates(corpus).flatMap(date => date.readings),
    known: knownWordKeys(retrievedDocs, question),
  };
}

function checkSources(
  answer: string,
  sources: GroundingSources,
): {grounded: boolean; issues: string[]} {
  if (!isEnabled()) {
    return {grounded: true, issues: []};
  }
  const rules = getSafetyConfig().groundingRules ?? {};
  const issues: string[] = [];

  // Currency amounts: PHP 299, ₱299, $10, 299 pesos. The number must match a
  // whole number in the records, so "PHP 29" does not pass on "299" or "2029".
  if (rules.forbidUnsourcedAmounts !== false) {
    const currencyRe = /(?:php|\$|₱|peso[s]?|usd|eur|gbp)\s*\d+(?:\.\d+)?/gi;
    const amountsInAnswer = answer.match(currencyRe) ?? [];
    for (const raw of amountsInAnswer) {
      const num = raw.match(NUMBER_RE)?.[0];
      if (!num) continue;
      if (!sources.numbers.has(Number(num))) {
        issues.push(`Amount "${raw}" is not present in the retrieved knowledge base`);
      }
    }
  }

  // Dates: a record says 2026-09-25 and a model writes September 25, 2026.
  // Both forms become month, day, and year parts before the comparison.
  if (rules.forbidUnsourcedDates !== false) {
    for (const {raw, readings} of parseDates(answer)) {
      const found = readings.some(reading => sources.dates.some(date => sameDate(reading, date)));
      if (!found) {
        issues.push(`Date "${raw}" is not present in the retrieved knowledge base`);
      }
    }
  }

  // Names: a model that answers from memory names someone the record does not.
  if (rules.forbidUnsourcedNames !== false) {
    for (const raw of unsourcedNames(answer, sources.known)) {
      issues.push(`Name "${raw}" is not present in the retrieved knowledge base`);
    }
  }

  return {grounded: issues.length === 0, issues};
}

export function checkGrounding(
  answer: string,
  retrievedDocs: KBDocument[],
  options: GroundingOptions = {},
): {grounded: boolean; issues: string[]} {
  return checkSources(answer, groundingSources(retrievedDocs, options.question));
}

/**
 * Token gate for streamed answers. Forwards text only up to the last
 * whitespace boundary, and only while the settled prefix passes the
 * grounding check. The first unsourced amount or date stops forwarding for
 * the rest of the stream, so partial model output never shows a value that
 * the final check would reject. The caller still runs validateAnswer on the
 * complete text.
 */
export interface GroundedTokenGate {
  /** Undefined when the caller gave no consumer, so providers skip streaming work. */
  onToken?: (token: string) => void;
  readonly halted: boolean;
}

export function createGroundedTokenGate(
  retrievedDocs: KBDocument[],
  onToken?: (token: string) => void,
  options: GroundingOptions = {},
): GroundedTokenGate {
  let received = '';
  let forwardedLength = 0;
  let halted = false;
  if (!onToken) {
    return {
      onToken: undefined,
      get halted() {
        return halted;
      },
    };
  }
  const sources = groundingSources(retrievedDocs, options.question);
  return {
    onToken(token: string) {
      if (halted) return;
      received += token;
      const trailingWord = received.match(/\S*$/)?.[0] ?? '';
      const settled = received.slice(0, received.length - trailingWord.length);
      if (settled.length <= forwardedLength) return;
      if (!checkSources(settled, sources).grounded) {
        halted = true;
        logger.info('safetyLayer', 'streamed answer halted at unsourced value');
        return;
      }
      onToken(settled.slice(forwardedLength));
      forwardedLength = settled.length;
    },
    get halted() {
      return halted;
    },
  };
}

/**
 * Main entry point: validate a final answer against retrieved context and
 * return a verdict. Callers decide whether to show the answer or a refusal
 * based on `verdict.allow`.
 */
export function validateAnswer(
  answer: string,
  retrievedDocs: KBDocument[],
  options: GroundingOptions = {},
): SafetyVerdict {
  const {confident, confidence} = checkConfidence(retrievedDocs);
  const retrievedDocIds = retrievedDocs.map(d => d.id);

  if (!confident) {
    return {
      allow: false,
      reason: 'low_confidence',
      refusalText: getRefusalTemplate('low_confidence'),
      issues: ['No documents matched the query with sufficient confidence'],
      confidence,
      retrievedDocIds,
    };
  }

  const {grounded, issues} = checkGrounding(answer, retrievedDocs, options);
  if (!grounded) {
    // Issues only: model output can repeat what the user typed.
    logger.warn('safetyLayer', 'Answer failed grounding check', {issues});
    return {
      allow: false,
      reason: 'ungrounded_answer',
      refusalText: getRefusalTemplate('ungrounded_answer'),
      issues,
      confidence,
      retrievedDocIds,
    };
  }

  return {
    allow: true,
    issues: [],
    confidence,
    retrievedDocIds,
  };
}

/**
 * Explicit refusal generator — for callers that know they want to refuse
 * for a specific reason (e.g. medical advice disclaimer from a tool).
 */
export function refusalFor(reason: RefusalReason): string {
  return getRefusalTemplate(reason);
}

/**
 * Public view of the configured safety policy — used by tests and the
 * observability dev panel.
 */
export function getSafetyPolicy() {
  const cfg = getSafetyConfig();
  return {
    enabled: isEnabled(),
    confidenceThreshold: cfg.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    blocklistSize: (cfg.topicBlocklist ?? []).length,
    groundingRules: cfg.groundingRules ?? {},
    brandHotline: brand.hotline,
  };
}
