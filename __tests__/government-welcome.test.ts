// The government welcome card and quick replies promise only what a sourced
// record answers. The shared core answers from public-evidence records only.

import {readFileSync, readdirSync} from 'fs';
import path from 'path';
import {answerPublicService, type PublicRecord} from '../src/core/publicService';

const ROOT = path.join(__dirname, '..', 'examples', 'government-services');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'airgap.config.json'), 'utf8'));
const records: PublicRecord[] = readdirSync(path.join(ROOT, 'knowledge'))
  .filter(file => file.endsWith('.json'))
  .flatMap(file => JSON.parse(readFileSync(path.join(ROOT, 'knowledge', file), 'utf8')));
const sourced = records.filter(record => record.metadata?.publicEvidence === true);
const sourcedText = sourced.map(record => `${record.title} ${record.content}`).join(' ');

const AGENCIES = ['PSA', 'SSS', 'PhilHealth', 'Pag-IBIG', 'BIR', 'LTO', 'NBI', 'DFA', 'DICT'];

test('names only agencies that a sourced record covers', () => {
  const features: string[] = cfg.onboarding.features;
  for (const agency of AGENCIES) {
    const claimed = features.some(line => new RegExp(`\\b${agency}\\b`).test(line));
    if (claimed) expect([agency, sourcedText.includes(agency)]).toEqual([agency, true]);
  }
});

const quickReplies: Array<[string, string]> = cfg.quickReplies.map(
  (reply: {title: string; value: string}) => [reply.title, reply.value],
);

test.each(quickReplies)('quick reply %s gets a sourced record', (_title, value) => {
  const answer = answerPublicService(value, records, {}, cfg.safety);
  expect(answer.answerPath).toBe('record');
});

test('every sourced record names its publisher for the answer card', () => {
  expect(sourced.filter(record => !record.metadata?.publisher).map(record => record.id)).toEqual(
    [],
  );
});

test('the passport quick reply names what its record gives', () => {
  const passport = cfg.quickReplies.find((reply: {value: string}) => /passport/i.test(reply.value));
  const answer = answerPublicService(passport.value, records, {}, cfg.safety);
  // svc-011 is the appointment site, not a list of steps.
  expect(answer.recordIds).toEqual(['svc-011']);
  expect(passport.title).not.toMatch(/steps/i);
});

test('each sourced record names the site its link opens', () => {
  const holidays = sourced.find(record => record.id === 'hol-001');
  expect(String(holidays?.metadata?.source)).toContain('elibrary.judiciary.gov.ph');
  expect(holidays?.metadata?.publisher).toBe('Supreme Court E-Library');
});
