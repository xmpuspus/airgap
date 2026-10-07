// A record marked verbatim answers as written. The identity statement of a
// bot must not change between runs, so no model phrases it.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));
jest.mock('../src/services/searchService', () => ({
  ...jest.requireActual('../src/services/searchService'),
  searchKB: jest.fn(),
}));

import {config} from '../src/config/loader';
import {registerInferenceProvider} from '../src/services/llmRouter';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {searchKB} from '../src/services/searchService';
import type {InferenceProvider} from '../src/services/inference/types';
import type {KBDocument} from '../src/types/knowledge';

const MODEL_TEXT = 'I am Bot, your friendly guide.';

const identity: KBDocument = {
  id: 'faq-identity',
  category: 'faq',
  title: 'Who this assistant is',
  content: 'This assistant is Bot, a sample on the Airgap kit. No agency runs it.',
  keywords: ['who are you'],
  tags: ['faq'],
  metadata: {verbatim: true},
};

function fixtureProvider(text: string): InferenceProvider {
  return {
    id: 'llama-rn',
    async getCapabilities() {
      return {
        providerId: 'llama-rn',
        state: 'available',
        locality: 'local',
        supportsStreaming: false,
        supportsCancellation: false,
        modelIdentity: 'fixture-model',
      };
    },
    async generate() {
      return {text, providerId: 'llama-rn', locality: 'local', modelIdentity: 'fixture-model'};
    },
    async cancel() {},
    getLastRunStats: () => null,
  };
}

describe('verbatim records', () => {
  const llm = config.llm as {mode?: string};
  const originalMode = llm.mode;

  beforeEach(() => {
    clearConversationHistory();
    llm.mode = 'prefer-offline';
    registerInferenceProvider(fixtureProvider(MODEL_TEXT));
  });

  afterEach(() => {
    llm.mode = originalMode;
  });

  it('answers with the whole record text and no model', async () => {
    (searchKB as jest.Mock).mockReturnValue([identity]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('search');
    expect(response.text).toContain('a sample on the Airgap kit. No agency runs it.');
    expect(response.text).not.toContain(MODEL_TEXT);
    expect(response.audit?.providerFailure).toBeUndefined();
  });

  it('shows a long record whole, with its source line at the end', async () => {
    const long: KBDocument = {
      ...identity,
      content: `${'A fact. '.repeat(40)}Source: https://example.gov.ph/page (checked 2026-10-07).`,
    };
    (searchKB as jest.Mock).mockReturnValue([long]);

    const response = await processMessage('who are you');

    expect(response.text.endsWith('(checked 2026-10-07).')).toBe(true);
    expect(response.text).not.toContain('...');
  });

  it('still lets the model phrase an ordinary record', async () => {
    (searchKB as jest.Mock).mockReturnValue([{...identity, metadata: {}}]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('llm');
    expect(response.text).toBe(MODEL_TEXT);
  });

  it('appends the record source line when the model drops it', async () => {
    (searchKB as jest.Mock).mockReturnValue([
      {
        ...identity,
        metadata: {source: 'https://www.ovp.gov.ph/category/1/press-release', asOf: '2026-10-07'},
      },
    ]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('llm');
    expect(response.text).toBe(
      `${MODEL_TEXT}\n\nSource: https://www.ovp.gov.ph/category/1/press-release (checked 2026-10-07).`,
    );
  });

  it('keeps model text that already carries the source', async () => {
    registerInferenceProvider(
      fixtureProvider(`${MODEL_TEXT} Source: https://example.gov.ph/page (checked 2026-10-07).`),
    );
    (searchKB as jest.Mock).mockReturnValue([
      {
        ...identity,
        content: `${identity.content} Source: https://example.gov.ph/page (checked 2026-10-07).`,
        metadata: {source: 'https://example.gov.ph/page', asOf: '2026-10-07'},
      },
    ]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('llm');
    expect(response.text.match(/Source:/g)).toHaveLength(1);
  });
});
