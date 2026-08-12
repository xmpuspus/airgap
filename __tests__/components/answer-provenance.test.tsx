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
