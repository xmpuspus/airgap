import {getProvenanceView} from '../../src/components/chat/AnswerProvenance';

test('states answer source, knowledge version, and source count', () => {
  expect(
    getProvenanceView({
      source: 'search',
      kbVersion: '2026.08',
      docIds: ['faq-1', 'faq-2'],
    }),
  ).toEqual({
    sourceLabel: 'Local knowledge',
    versionLabel: 'v2026.08',
    sourceCountLabel: '2 sources',
  });
});

test.each([
  ['apple-foundation-models', 'Apple on-device model'],
  ['android-aicore', 'Android on-device model'],
  ['llama-rn', 'Downloaded Airgap model'],
  ['cloud', 'Cloud model'],
  ['demo', 'Document answer'],
] as const)('names the %s provider in answer details', (providerId, sourceLabel) => {
  expect(
    getProvenanceView({
      source: 'llm',
      providerId,
      modelIdentity: `${providerId}-model`,
    }),
  ).toMatchObject({sourceLabel, modelLabel: `${providerId}-model`});
});
