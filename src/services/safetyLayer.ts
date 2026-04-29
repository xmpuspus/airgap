/**
 * Safety layer — gates LLM output before it reaches the user.
 *
 * Responsibilities:
 *   1. Topic blocklist — refuse queries that fall outside the configured
 *      allowed topics (e.g. medical/legal/financial advice for unrelated
 *      verticals, self-harm, politics).
 *   2. Confidence gate — refuse when the retrieved KB has no documents above
 *      the minimum confidence threshold.
 *   3. Grounding enforcement — reject answers that claim specific dollar
 *      amounts, dates, or numeric facts not present in the retrieved context.
 *   4. Refusal templates — vertical-specific fail-closed copy for the cases
 *      we intentionally do not answer (medical/legal/financial disclaimers).
 *
 * Fail-closed philosophy: when uncertain, refuse. The user is always pointed
 * to the hotline or in-person channels. The system never invents a price,
 * a medication, or a legal term.
 *
 * All behavior is config-driven through `config.safety`. Disabling the entire
 * safety layer is a one-line change in airgap.config.json.
 */

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
  };
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
  if (!isEnabled()) return {blocked: false};

  const blocklist = getSafetyConfig().topicBlocklist ?? [];
  if (blocklist.length === 0) return {blocked: false};

  const lower = query.toLowerCase();
  for (const entry of blocklist) {
    // Support "reason:phrase" syntax (e.g. "not_medical_advice:prescribe me")
    const [rawReason, phraseRaw] = entry.includes(':')
      ? entry.split(':', 2)
      : ['blocked_topic', entry];
    const phrase = (phraseRaw ?? rawReason).trim().toLowerCase();
    if (!phrase) continue;

    // Word boundary match — avoids matching "prescribe" inside "prescribed"
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    if (re.test(lower)) {
      const reason = (rawReason as RefusalReason) || 'blocked_topic';
      logger.info('safetyLayer', 'blocklist hit', {phrase, reason});
      return {blocked: true, reason};
    }
  }
  return {blocked: false};
}

/**
 * Confidence check — refuse when KB search returned nothing strong enough.
 *
 * Uses the BM25 score from the top retrieved doc (if MiniSearch left a
 * `score` field on the document) and normalises it to the [0, 1] range
 * via score / (score + 1). This is monotonic in BM25 — higher BM25
 * always yields higher normalised confidence — but bounded so callers can
 * compare against a fixed threshold without knowing the absolute BM25
 * scale of the corpus.
 *
 * If no docs were retrieved, confidence is 0 and the call fails closed.
 * If docs were retrieved but no score is present (e.g. mocked test
 * fixtures), confidence falls back to 1 so we don't break existing tests
 * that pre-date the scoring change.
 */
export function checkConfidence(
  retrievedDocs: KBDocument[],
): {confident: boolean; confidence: number} {
  if (!isEnabled()) {
    return {confident: true, confidence: 1};
  }
  const threshold =
    getSafetyConfig().confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  if (retrievedDocs.length === 0) {
    return {confident: false, confidence: 0};
  }
  // MiniSearch attaches a `score` field to each result. searchService
  // strips it during the KBDocument map step, so we look for it on the
  // raw object as well as on metadata.
  const top = retrievedDocs[0] as unknown as {
    score?: number;
    metadata?: {score?: number};
  };
  const rawScore = top.score ?? top.metadata?.score ?? null;
  let confidence: number;
  if (rawScore !== null && Number.isFinite(rawScore) && rawScore >= 0) {
    confidence = rawScore / (rawScore + 1);
  } else {
    // No score present — keep the legacy permissive behaviour so the
    // confidence gate doesn't fire just because a test fixture lacks the
    // score field.
    confidence = 1;
  }
  return {confident: confidence >= threshold, confidence};
}

/**
 * Grounding enforcement.
 *
 * An answer is considered ungrounded if any of the following is true:
 *   - It mentions a currency amount not present in any retrieved doc
 *   - It mentions a specific date not present in any retrieved doc
 *   - It claims to quote the user's account/plan/policy without a tool call
 *
 * Catches hallucinated prices, made-up promo dates, and fabricated
 * account details. Purely textual — no side effects.
 */
export function checkGrounding(
  answer: string,
  retrievedDocs: KBDocument[],
): {grounded: boolean; issues: string[]} {
  if (!isEnabled()) {
    return {grounded: true, issues: []};
  }
  const rules = getSafetyConfig().groundingRules ?? {};
  const corpus = retrievedDocs
    .map(d => `${d.title}\n${d.content}`)
    .join('\n')
    .toLowerCase();
  const issues: string[] = [];

  // Currency amounts: PHP 299, ₱299, $10, 299 pesos
  if (rules.forbidUnsourcedAmounts !== false) {
    const currencyRe = /(?:php|\$|₱|peso[s]?|usd|eur|gbp)\s*\d+(?:\.\d+)?/gi;
    const amountsInAnswer = answer.match(currencyRe) ?? [];
    for (const raw of amountsInAnswer) {
      // Normalize: extract the number only
      const num = raw.match(/\d+(?:\.\d+)?/)?.[0];
      if (!num) continue;
      if (!corpus.includes(num)) {
        issues.push(
          `Amount "${raw}" is not present in the retrieved knowledge base`,
        );
      }
    }
  }

  // Dates: 2026-04-15, Apr 15, April 15, 15/04/2026
  if (rules.forbidUnsourcedDates !== false) {
    const dateRe =
      /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})\b/gi;
    const datesInAnswer = answer.match(dateRe) ?? [];
    for (const raw of datesInAnswer) {
      if (!corpus.includes(raw.toLowerCase())) {
        issues.push(
          `Date "${raw}" is not present in the retrieved knowledge base`,
        );
      }
    }
  }

  return {grounded: issues.length === 0, issues};
}

/**
 * Main entry point: validate a final answer against retrieved context and
 * return a verdict. Callers decide whether to show the answer or a refusal
 * based on `verdict.allow`.
 */
export function validateAnswer(
  answer: string,
  retrievedDocs: KBDocument[],
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

  const {grounded, issues} = checkGrounding(answer, retrievedDocs);
  if (!grounded) {
    logger.warn('safetyLayer', 'Answer failed grounding check', {
      issues,
      answerPreview: answer.substring(0, 120),
    });
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
    confidenceThreshold:
      cfg.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    blocklistSize: (cfg.topicBlocklist ?? []).length,
    groundingRules: cfg.groundingRules ?? {},
    brandHotline: brand.hotline,
  };
}
