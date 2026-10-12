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
    'Apple on-device model did not answer: The Apple system model does not support this locale. The record is shown as written.',
  );
});

test('says in plain words when the model reply was not an exact copy of the record', () => {
  const view = getProvenanceView({
    source: 'search',
    docIds: ['off-001'],
    providerFailure: {
      providerId: 'llama-rn',
      reason: 'not_exact_copy',
      message: 'the model text was not the record, so the record shows',
    },
  });
  expect(view.failureLabel).toBe(
    'Downloaded Airgap model ran, but its reply was not an exact copy of the record. The record is shown as written.',
  );
  expect(view.failureLabel).not.toContain('ungrounded');
});

test('says when the model ran out of time', () => {
  const view = getProvenanceView({
    source: 'search',
    docIds: ['off-009'],
    providerFailure: {
      reason: 'generation_failed',
      message: 'Error: Generation timed out after 240s',
    },
  });
  expect(view.failureLabel).toBe(
    'The model did not finish in time. The record is shown as written.',
  );
});

test('names the unsourced detail check for a general model answer', () => {
  const view = getProvenanceView({
    source: 'search',
    docIds: ['plan-1', 'plan-2'],
    providerFailure: {providerId: 'llama-rn', reason: 'ungrounded', message: 'Amount "PHP 4999"'},
  });
  expect(view.failureLabel).toBe(
    'Downloaded Airgap model ran, but its reply had a detail that is not in the records. The records are shown as written.',
  );
});

test('shows the publisher and checked date of a dated public record', () => {
  expect(
    getProvenanceView({
      source: 'search',
      docIds: ['off-001'],
      recordSource: {
        publisher: 'Presidential Communications Office',
        checkedLabel: 'Checked 2026-10-09, 3 days ago',
      },
    }),
  ).toEqual({
    sourceLabel: 'Local knowledge',
    factLabel: 'Presidential Communications Office · Checked 2026-10-09, 3 days ago',
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

test('shows no source count for app guidance', () => {
  expect(getProvenanceView({source: 'system', docIds: []})).toEqual({
    sourceLabel: 'App guidance',
  });
  expect(getProvenanceView({source: 'system', responseReason: 'device_clock'})).toEqual({
    sourceLabel: 'App guidance',
    factLabel: "Date and time from this phone's clock",
  });
  expect(getProvenanceView({source: 'system', responseReason: 'identity'})).toEqual({
    sourceLabel: 'App guidance',
    factLabel: 'Set in the app, not taken from a record',
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
  ).toMatchObject({sourceLabel, modelLabel: `Model: ${providerId}-model`});
});
