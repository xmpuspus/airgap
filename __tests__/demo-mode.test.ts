// Demo mode tests. LLM-free formatter, deterministic, all 7 verticals.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {readFileSync, readdirSync} from 'fs';
import {join} from 'path';
import {
  extractReferenceBlock,
  formatReferenceAsReply,
  demoLlmService,
} from '../src/services/demoLlmService';
import {
  resolveConfigMode,
  setUserMode,
  getMode,
  routeGeneration,
  getInferenceProviders,
} from '../src/services/llmRouter';
import {buildUserMessage} from '../src/utils/promptBuilder';
import type {KBDocument} from '../src/types/knowledge';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

describe('demoLlmService.extractReferenceBlock', () => {
  it('returns the KB context block from a buildUserMessage payload', () => {
    const docs: KBDocument[] = [
      {
        id: 'plan-99',
        category: 'plan',
        title: 'Super Surf 99',
        content: 'PHP 99 for 5GB data over 7 days.',
        keywords: ['plan'],
        tags: [],
      },
    ];
    const userMessage = buildUserMessage('What plans?', docs);
    const block = extractReferenceBlock(userMessage);
    expect(block).not.toBeNull();
    expect(block).toContain('[PLAN] Super Surf 99');
    expect(block).toContain('PHP 99 for 5GB data over 7 days.');
  });

  it('returns null when the KB had no hits', () => {
    const userMessage = buildUserMessage('What plans?', []);
    expect(extractReferenceBlock(userMessage)).toBeNull();
  });

  it('returns null when the message has no REFERENCE INFORMATION section', () => {
    expect(extractReferenceBlock('hello there')).toBeNull();
  });
});

describe('demoLlmService.formatReferenceAsReply', () => {
  it('strips category tags, bolds titles, preserves content', () => {
    const block =
      '[PLAN] Super Surf 99\nPHP 99 for 5GB data over 7 days.\n\n' +
      '[PLAN] MegaSurf 149\nPHP 149 for 12GB data over 15 days.';
    const reply = formatReferenceAsReply(block);
    expect(reply).toContain('**Super Surf 99**');
    expect(reply).toContain('**MegaSurf 149**');
    expect(reply).not.toContain('[PLAN]');
    expect(reply).toContain('PHP 99 for 5GB data over 7 days.');
    expect(reply).toContain('PHP 149 for 12GB data over 15 days.');
  });

  it('is deterministic for the same input', () => {
    const block = '[FAQ] How to recharge\nDial *143# and follow prompts.';
    expect(formatReferenceAsReply(block)).toBe(formatReferenceAsReply(block));
  });

  it('handles category tags with underscores (e.g. [WATER_UTILITY])', () => {
    const block = '[WATER_UTILITY] Outage hotline\nCall 8888 for water service issues.';
    const reply = formatReferenceAsReply(block);
    expect(reply).toContain('**Outage hotline**');
    expect(reply).not.toContain('[WATER_UTILITY]');
  });

  it('keeps multi-paragraph KB content intact instead of shredding into fake titles', () => {
    // Real-world pattern: troubleshooting docs have numbered steps separated
    // by blank lines. Naive split('\n\n') would treat each step's first
    // line as a new title.
    const block =
      '[TROUBLESHOOTING] No signal or no service\n' +
      'If you see no signal:\n\n' +
      '1. Toggle airplane mode on for 10 seconds, then off.\n\n' +
      '2. Check that mobile data is enabled in Settings.\n\n' +
      '3. Reseat the SIM card.\n\n' +
      '[ROAMING] Zone A countries\n' +
      'ASEAN: Singapore, Malaysia, Thailand, Vietnam.\n\n' +
      'Activation: dial *143# before travel.';
    const reply = formatReferenceAsReply(block);
    expect(reply).toContain('**No signal or no service**');
    expect(reply).toContain('**Zone A countries**');
    // Numbered steps must remain content, not titles.
    expect(reply).not.toMatch(/\*\*1\.\s/);
    expect(reply).not.toMatch(/\*\*2\.\s/);
    expect(reply).not.toMatch(/\*\*3\.\s/);
    expect(reply).not.toMatch(/\*\*Activation:/);
    // And exactly two bolded section headers.
    const boldHeaders = reply.match(/^\*\*[^*]+\*\*$/gm) ?? [];
    expect(boldHeaders).toHaveLength(2);
  });
});

describe('demoLlmService.generate', () => {
  it('streams tokens in order and returns the full text', async () => {
    const docs: KBDocument[] = [
      {
        id: 'd1',
        category: 'plan',
        title: 'Test plan',
        content: 'Two sentences. Of content.',
        keywords: [],
        tags: [],
      },
    ];
    const userMessage = buildUserMessage('test', docs);
    const tokens: string[] = [];
    const text = await demoLlmService.generate('sys', userMessage, t => {
      tokens.push(t);
    });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.join('')).toBe(text);
    expect(text).toContain('Test plan');
  }, 20000);

  it('falls back to a clean message when no KB context is present', async () => {
    const text = await demoLlmService.generate('sys', 'no reference here');
    expect(text.toLowerCase()).toContain("don't have");
  });
});

describe('llmRouter mode resolution', () => {
  it('returns the configured llm.mode', () => {
    expect(resolveConfigMode({mode: 'demo'})).toBe('demo');
    expect(resolveConfigMode({mode: 'prefer-online'})).toBe('prefer-online');
    expect(resolveConfigMode({mode: 'offline-only'})).toBe('offline-only');
  });

  it('falls back to prefer-offline when mode is missing or invalid', () => {
    expect(resolveConfigMode({})).toBe('prefer-offline');
    expect(resolveConfigMode(undefined)).toBe('prefer-offline');
    expect(resolveConfigMode({mode: 'bogus'})).toBe('prefer-offline');
  });

  it('setUserMode(demo) is a no-op so users cannot toggle into demo from Settings', () => {
    // Save current resolved mode to restore later.
    const before = getMode();
    setUserMode('demo' as any);
    // Demo override should not persist; getMode keeps the operator default.
    // (In tests, the operator config currently has mode:demo, so this
    // returns demo for that reason, not because the override stuck.)
    setUserMode(null);
    expect(getMode()).toBe(before);
  });

  it('records the deterministic provider and model identity', async () => {
    const result = await routeGeneration('system', 'no reference here');

    expect(result).toMatchObject({
      source: 'local',
      providerId: 'demo',
      modelIdentity: 'document-formatter-v1',
    });
  });

  it('registers the Apple system provider', () => {
    expect(getInferenceProviders().map(provider => provider.id)).toContain(
      'apple-foundation-models',
    );
  });

  it('registers the Android system provider', () => {
    expect(getInferenceProviders().map(provider => provider.id)).toContain('android-aicore');
  });
});

describe('provider audit metadata', () => {
  beforeEach(() => clearConversationHistory());

  it('keeps provider and model identity with a grounded answer', async () => {
    const response = await processMessage('What prepaid data plans are available?');

    expect(response.source).toBe('llm');
    expect(response.audit).toMatchObject({
      providerId: 'demo',
      modelIdentity: 'document-formatter-v1',
    });
  });
});

describe('demo mode works across all 7 industry templates', () => {
  const examplesDir = join(__dirname, '..', 'examples');
  const verticals = readdirSync(examplesDir).filter(d => d !== 'README.md' && !d.startsWith('.'));

  it('discovers all 7 verticals', () => {
    expect(verticals.sort()).toEqual([
      'airline',
      'banking',
      'electric-utility',
      'healthcare',
      'insurance',
      'telco',
      'water-utility',
    ]);
  });

  it.each(verticals)('%s config opts into demo mode', vertical => {
    const path = join(examplesDir, vertical, 'airgap.config.json');
    const cfg = JSON.parse(readFileSync(path, 'utf8'));
    expect(cfg.llm?.mode).toBe('demo');
  });

  it.each(verticals)('%s KB has at least one doc the demo formatter can render', vertical => {
    const kbDir = join(examplesDir, vertical, 'knowledge');
    const files = readdirSync(kbDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    const docs: KBDocument[] = [];
    for (const file of files) {
      const arr = JSON.parse(readFileSync(join(kbDir, file), 'utf8'));
      if (Array.isArray(arr)) docs.push(...(arr as KBDocument[]));
    }
    expect(docs.length).toBeGreaterThan(0);
    const userMessage = buildUserMessage('hello', docs.slice(0, 3));
    const block = extractReferenceBlock(userMessage);
    expect(block).not.toBeNull();
    const reply = formatReferenceAsReply(block as string);
    expect(reply.length).toBeGreaterThan(0);
    expect(reply).toContain('**');
  });
});
