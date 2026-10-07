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

  it('answers with the record text and no model', async () => {
    (searchKB as jest.Mock).mockReturnValue([identity]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('search');
    expect(response.text).toContain('a sample on the Airgap kit');
    expect(response.text).not.toContain(MODEL_TEXT);
    expect(response.audit?.providerFailure).toBeUndefined();
  });

  it('still lets the model phrase an ordinary record', async () => {
    (searchKB as jest.Mock).mockReturnValue([{...identity, metadata: {}}]);

    const response = await processMessage('who are you');

    expect(response.source).toBe('llm');
    expect(response.text).toBe(MODEL_TEXT);
  });
});
