// The government branch shows the record unless the model copied it exactly.
// The answer card must say which of the two happened, in plain words.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {readFileSync, readdirSync} from 'fs';
import {join} from 'path';
import {config} from '../src/config/loader';
import {registerInferenceProvider} from '../src/services/llmRouter';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {replaceKnowledgeFromBundle, revertToCompiledKnowledge} from '../src/knowledge';
import type {InferenceProvider} from '../src/services/inference/types';
import type {SafetyConfig} from '../src/services/safetyLayer';

const government = JSON.parse(
  readFileSync(join(__dirname, '../examples/government-services/airgap.config.json'), 'utf8'),
);

function fixtureProvider(reply: () => string): InferenceProvider {
  return {
    id: 'llama-rn',
    async getCapabilities() {
      return {
        providerId: 'llama-rn',
        state: 'available',
        locality: 'local',
        supportsStreaming: false,
        supportsCancellation: false,
        modelIdentity: 'fixture-model.gguf',
      };
    },
    async generate() {
      return {
        text: reply(),
        providerId: 'llama-rn',
        locality: 'local',
        modelIdentity: 'fixture-model.gguf',
      };
    },
    async cancel() {},
    getLastRunStats: () => null,
  };
}

describe('government model control', () => {
  const configured = config as typeof config & {safety?: SafetyConfig};
  const previous = {llm: config.llm, safety: configured.safety};

  beforeEach(() => {
    clearConversationHistory();
    config.llm = {
      ...government.llm,
      mode: 'offline-only',
      providers: [{id: 'llama-rn', enabled: true, priority: 0, platform: 'all'}],
    };
    configured.safety = government.safety;
    const directory = join(__dirname, '../examples/government-services/knowledge');
    const files = Object.fromEntries(
      readdirSync(directory)
        .filter(file => file.endsWith('.json'))
        .map(file => [file, readFileSync(join(directory, file), 'utf8')]),
    );
    replaceKnowledgeFromBundle(JSON.stringify({files}));
  });

  afterEach(() => {
    config.llm = previous.llm;
    configured.safety = previous.safety;
    clearConversationHistory();
    revertToCompiledKnowledge();
  });

  it('shows the record and names an inexact copy when the model paraphrases', async () => {
    registerInferenceProvider(
      fixtureProvider(() => 'Ferdinand R. Marcos Jr. is the President of the Philippines.'),
    );
    const response = await processMessage('Who is the current president?');
    expect(response.source).toBe('search');
    expect(response.text).toContain('The PCO transcript dated 27 July 2026');
    expect(response.audit?.providerFailure).toEqual({
      providerId: 'llama-rn',
      reason: 'not_exact_copy',
      message: 'the model reply was not an exact copy of the record',
    });
    expect(response.audit?.modelIdentity).toBe('fixture-model.gguf');
  });

  it('names the provider when the model throws', async () => {
    registerInferenceProvider(
      fixtureProvider(() => {
        throw new Error('Generation timed out after 240s');
      }),
    );
    const response = await processMessage('Who is the current president?');
    expect(response.source).toBe('search');
    expect(response.audit?.providerFailure).toMatchObject({
      providerId: 'llama-rn',
      message: expect.stringContaining('timed out'),
    });
  });
});
