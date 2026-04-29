/**
 * Safety layer tests.
 *
 * Asserts the blocklist, confidence gate, and grounding enforcement all
 * fail-close on the seeded adversarial prompts. One per vertical is covered
 * via pure unit tests that don't need an LLM loaded. Orchestrator-level
 * end-to-end coverage lives in __tests__/journeys.ts and the golden eval
 * fixtures under __tests__/golden/.
 */

import {
  checkBlocklist,
  checkConfidence,
  checkGrounding,
  validateAnswer,
  refusalFor,
  getSafetyPolicy,
} from '../src/services/safetyLayer';
import type {KBDocument} from '../src/types/knowledge';

function doc(overrides: Partial<KBDocument> = {}): KBDocument {
  return {
    id: 'x',
    category: 'faq',
    title: 'Test Doc',
    content: 'test body',
    keywords: [],
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('safetyLayer.checkBlocklist', () => {
  test('allows benign telco query', () => {
    const result = checkBlocklist('what prepaid plans do you have');
    expect(result.blocked).toBe(false);
  });

  test('blocks "diagnose me" with not_medical_advice reason', () => {
    const result = checkBlocklist('can you diagnose me with a rash');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('not_medical_advice');
  });

  test('blocks "should I invest" with not_financial_advice reason', () => {
    const result = checkBlocklist('should i invest my balance in crypto');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('not_financial_advice');
  });

  test('blocks "sue" with not_legal_advice reason', () => {
    const result = checkBlocklist('can I sue you over the outage');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('not_legal_advice');
  });

  test('does not match substring ("suede")', () => {
    const result = checkBlocklist('my suede case is broken');
    expect(result.blocked).toBe(false);
  });

  test('does not block "political" inside a harmless word ("apolitical")', () => {
    const result = checkBlocklist('I am an apolitical customer');
    expect(result.blocked).toBe(false);
  });
});

describe('safetyLayer.checkConfidence', () => {
  test('empty results => not confident', () => {
    const {confident, confidence} = checkConfidence([]);
    expect(confident).toBe(false);
    expect(confidence).toBe(0);
  });

  test('any result passes the default threshold', () => {
    const {confident} = checkConfidence([doc()]);
    expect(confident).toBe(true);
  });
});

describe('safetyLayer.checkGrounding', () => {
  test('answer with no numbers is grounded', () => {
    const result = checkGrounding('We offer prepaid and postpaid plans.', [
      doc({content: 'prepaid postpaid plans'}),
    ]);
    expect(result.grounded).toBe(true);
  });

  test('answer with a currency amount present in KB is grounded', () => {
    const result = checkGrounding('The plan is PHP 299 per month.', [
      doc({content: 'The basic plan is 299 pesos per month.'}),
    ]);
    expect(result.grounded).toBe(true);
  });

  test('answer with a currency amount NOT in KB fails grounding', () => {
    const result = checkGrounding('Pay $1000 now to resolve this.', [
      doc({content: 'Pay your bill at any 7-Eleven.'}),
    ]);
    expect(result.grounded).toBe(false);
    expect(result.issues.join(' ')).toMatch(/Amount "\$1000"/);
  });

  test('answer with a made-up date fails grounding', () => {
    const result = checkGrounding(
      'Your expiry is 2030-12-31, do not worry.',
      [doc({content: 'Standard SIMs expire 30 days after last load.'})],
    );
    expect(result.grounded).toBe(false);
    expect(result.issues.join(' ')).toMatch(/Date "2030-12-31"/);
  });
});

describe('safetyLayer.validateAnswer', () => {
  test('low-confidence empty KB returns refusal', () => {
    const verdict = validateAnswer('anything', []);
    expect(verdict.allow).toBe(false);
    expect(verdict.reason).toBe('low_confidence');
    expect(verdict.refusalText).toBeTruthy();
  });

  test('grounded, confident answer is allowed', () => {
    const verdict = validateAnswer('Plans start at PHP 299.', [
      doc({content: 'Plan 299 is our entry tier at PHP 299 per month.'}),
    ]);
    expect(verdict.allow).toBe(true);
  });

  test('confident but ungrounded answer is refused', () => {
    const verdict = validateAnswer('Pay $9999 now.', [
      doc({content: 'Bill payment channels: 7-Eleven, GCash, online banking.'}),
    ]);
    expect(verdict.allow).toBe(false);
    expect(verdict.reason).toBe('ungrounded_answer');
  });
});

describe('safetyLayer.refusalFor', () => {
  test('every reason returns non-empty refusal', () => {
    const reasons = [
      'blocked_topic',
      'low_confidence',
      'ungrounded_answer',
      'not_medical_advice',
      'not_financial_advice',
      'not_legal_advice',
      'state_changing_offline',
    ] as const;
    for (const r of reasons) {
      const text = refusalFor(r);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    }
  });
});

describe('safetyLayer.getSafetyPolicy', () => {
  test('reports the active policy snapshot', () => {
    const policy = getSafetyPolicy();
    expect(policy.enabled).toBe(true);
    expect(typeof policy.blocklistSize).toBe('number');
    expect(policy.brandHotline).toBeTruthy();
  });
});
