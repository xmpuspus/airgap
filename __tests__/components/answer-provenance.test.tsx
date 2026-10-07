import {getProvenanceView} from '../../src/components/chat/AnswerProvenance';

test('says why the model did not answer when the app fell back to records', () => {
  const view = getProvenanceView({
    source: 'search',
    docIds: ['off-001'],
    providerFailure: {
      providerId: 'apple-foundation-models',
      reason: 'generation_failed',
      message: 'The Apple system model does not support this locale',
    },
  });
  expect(view.sourceLabel).toBe('Local knowledge');
  expect(view.failureLabel).toBe(
    'Apple on-device model did not answer (generation_failed): The Apple system model does not support this locale',
  );
});

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
