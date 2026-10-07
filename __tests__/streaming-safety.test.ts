// Streamed model text must never show an unsourced amount or date, even for a
// moment, before the final answer check replaces it with the record.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {config} from '../src/config/loader';
import {registerInferenceProvider} from '../src/services/llmRouter';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {createGroundedTokenGate} from '../src/services/safetyLayer';
import type {InferenceProvider} from '../src/services/inference/types';
import type {KBDocument} from '../src/types/knowledge';

const UNGROUNDED_TEXT =
  'Super Surf 99 now costs PHP 4999 per month and the promo ends Jan 31 for everyone.';

function streamingFixtureProvider(text: string): InferenceProvider {
  return {
    id: 'llama-rn',
    async getCapabilities() {
      return {
        providerId: 'llama-rn',
        state: 'available',
        locality: 'local',
        supportsStreaming: true,
        supportsCancellation: true,
        modelIdentity: 'fixture-ungrounded-model',
      };
    },
    async generate(request) {
      for (const chunk of text.split(/(?<=\s)/)) request.onToken?.(chunk);
      return {
        text,
        providerId: 'llama-rn',
        locality: 'local',
        modelIdentity: 'fixture-ungrounded-model',
      };
    },
    async cancel() {},
    getLastRunStats: () => null,
  };
}

describe('streamed answers stay behind the grounding check', () => {
  const llm = config.llm as {mode?: string};
  const originalMode = llm.mode;

  beforeEach(() => {
    clearConversationHistory();
    llm.mode = 'prefer-offline';
    registerInferenceProvider(streamingFixtureProvider(UNGROUNDED_TEXT));
  });

  afterEach(() => {
    llm.mode = originalMode;
  });

  it('never forwards an unsourced amount or date to the chat screen', async () => {
    const forwarded: string[] = [];
    const response = await processMessage('What is Super Surf 99?', {
      onToken: token => forwarded.push(token),
    });

    const shown = forwarded.join('');
    expect(shown).not.toContain('4999');
    expect(shown).not.toContain('Jan 31');
    expect(response.text).not.toContain('4999');
  });

  it('shows the record instead and says why the model did not answer', async () => {
    const response = await processMessage('What is Super Surf 99?');

    expect(response.source).toBe('search');
    expect(response.text).toContain('Super Surf 99');
    expect(response.audit?.refusalReason).toBeUndefined();
    expect(response.audit?.providerFailure).toEqual({
      providerId: 'llama-rn',
      reason: 'ungrounded',
      message: expect.stringMatching(/Amount "PHP 4999"/),
    });
  });
});

describe('createGroundedTokenGate', () => {
  const docs: KBDocument[] = [
    {
      id: 'fee-1',
      category: 'fees',
      title: 'Passport fee',
      content: 'As of 2026-10-07 the regular passport fee is PHP 950. Source: dfa.gov.ph.',
      keywords: [],
      tags: [],
      metadata: {},
    },
  ];

  it('forwards sourced words as they complete and stops at the first unsourced value', () => {
    const out: string[] = [];
    const gate = createGroundedTokenGate(docs, token => out.push(token));
    for (const chunk of [
      'The ',
      'fee ',
      'is ',
      'PHP ',
      '95',
      '0 ',
      'or ',
      'PHP ',
      '12',
      '00 ',
      'later.',
    ]) {
      gate.onToken?.(chunk);
    }
    expect(out.join('')).toBe('The fee is PHP 950 or PHP ');
    expect(gate.halted).toBe(true);
  });

  it('does not forward a partial number that is still streaming', () => {
    const out: string[] = [];
    const gate = createGroundedTokenGate(docs, token => out.push(token));
    gate.onToken?.('PHP 9');
    expect(out.join('')).toBe('PHP ');
    gate.onToken?.('50 today');
    expect(out.join('')).toBe('PHP 950 ');
    expect(gate.halted).toBe(false);
  });

  it('passes every token through when the safety layer has nothing to check', () => {
    const out: string[] = [];
    const gate = createGroundedTokenGate(docs, token => out.push(token));
    for (const chunk of ['Bring ', 'a ', 'valid ', 'ID. ']) gate.onToken?.(chunk);
    expect(out.join('')).toBe('Bring a valid ID. ');
    expect(gate.halted).toBe(false);
  });
});
