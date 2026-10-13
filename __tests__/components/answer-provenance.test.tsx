import {getProvenanceView} from '../../src/components/chat/AnswerProvenance';

// The card tells a citizen where the answer came from, and nothing about how
// the reply was produced.
test('shows only the record source when the card shows the stored record', () => {
  expect(
    getProvenanceView({
      source: 'search',
      docIds: ['off-001'],
      providerId: 'llama-rn',
      recordSource: {
        publisher: 'Presidential Communications Office',
        checkedLabel: 'Checked 2026-10-09, 4 days ago',
      },
    }),
  ).toEqual({
    sourceLabel: 'Local knowledge',
    factLabel: 'Presidential Communications Office · Checked 2026-10-09, 4 days ago',
  });
});

test('counts local records and names a synced version', () => {
  expect(
    getProvenanceView({
      source: 'search',
      kbVersion: '2026.08',
      docIds: ['faq-1', 'faq-2'],
    }),
  ).toEqual({
    sourceLabel: 'Local knowledge',
    factLabel: '2 local records · v2026.08',
  });
});

test('labels an app answer with no extra explanation', () => {
  expect(getProvenanceView({source: 'system', docIds: []})).toEqual({sourceLabel: 'App guidance'});
});

test.each([
  ['apple-foundation-models', 'Apple on-device model'],
  ['android-aicore', 'Android on-device model'],
  ['llama-rn', 'Downloaded Airgap model'],
  ['cloud', 'Cloud model'],
  ['demo', 'Document answer'],
] as const)('names the %s provider when it wrote the answer', (providerId, sourceLabel) => {
  expect(getProvenanceView({source: 'llm', providerId})).toEqual({sourceLabel});
});
