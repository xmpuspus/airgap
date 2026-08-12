import {validateConfig} from '../src/config/validate';
import type {AirgapConfig} from '../src/config/loader';

function makeValidConfig(overrides: Partial<AirgapConfig> = {}): AirgapConfig {
  return {
    specVersion: '1.0.0',
    brand: {name: 'Test Co', botName: 'TestBot', hotline: '123'},
    theme: {primary: '#0047AB', secondary: '#FF6B00', background: '#F5F7FA'},
    model: {provider: 'llama.cpp', url: 'https://example.com/model.gguf', filename: 'model.gguf'},
    knowledge: {directory: 'knowledge'},
    prompts: {system: 'You are a bot.', welcome: 'Hi!', fallback: 'Sorry.'},
    features: {},
    onboarding: {},
    quickReplies: [{title: 'Help', value: 'Help me'}],
    actions: [{id: 'test', label: 'Test', keywords: ['test'], requiresOnline: true}],
    backend: {type: 'mock'},
    support: [],
    locale: {},
    ...overrides,
  } as AirgapConfig;
}

describe('validateConfig', () => {
  test('valid config returns no errors', () => {
    const result = validateConfig(makeValidConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing brand.name', () => {
    const cfg = makeValidConfig({brand: {name: '', botName: 'Bot', hotline: '123'}});
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('brand.name must be a non-empty string');
  });

  test('missing brand.botName', () => {
    const cfg = makeValidConfig({brand: {name: 'Co', botName: '', hotline: '123'}});
    const result = validateConfig(cfg);
    expect(result.errors).toContain('brand.botName must be a non-empty string');
  });

  test('invalid hex color in theme.primary', () => {
    const cfg = makeValidConfig({
      theme: {primary: 'red', secondary: '#FF6B00', background: '#F5F7FA'},
    });
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('theme.primary'))).toBe(true);
  });

  test('invalid model provider', () => {
    const cfg = makeValidConfig({
      model: {provider: 'tensorflow' as any, url: 'https://x.com/m.gguf', filename: 'm.gguf'},
    });
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('model.provider'))).toBe(true);
  });

  test('invalid model URL', () => {
    const cfg = makeValidConfig({
      model: {provider: 'llama.cpp', url: 'not-a-url', filename: 'm.gguf'},
    });
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('model.url'))).toBe(true);
  });

  test('missing prompts.system', () => {
    const cfg = makeValidConfig({prompts: {system: '', welcome: 'Hi', fallback: 'Sorry'}});
    const result = validateConfig(cfg);
    expect(result.errors).toContain('prompts.system must be a non-empty string');
  });

  test('empty actions array', () => {
    const cfg = makeValidConfig({actions: []});
    const result = validateConfig(cfg);
    expect(result.errors).toContain('actions must be a non-empty array');
  });

  // New enterprise fields
  test('valid darkMode values accepted', () => {
    for (const dm of [true, false, 'auto']) {
      const cfg = makeValidConfig({
        theme: {
          primary: '#0047AB',
          secondary: '#FF6B00',
          background: '#F5F7FA',
          darkMode: dm as any,
        },
      });
      const result = validateConfig(cfg);
      expect(result.errors.filter(e => e.includes('darkMode'))).toHaveLength(0);
    }
  });

  test('invalid darkMode value', () => {
    const cfg = makeValidConfig({
      theme: {
        primary: '#0047AB',
        secondary: '#FF6B00',
        background: '#F5F7FA',
        darkMode: 'maybe' as any,
      },
    });
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('darkMode'))).toBe(true);
  });

  test('invalid privacy.dataRetentionDays', () => {
    const cfg = makeValidConfig({privacy: {dataRetentionDays: -1}});
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('dataRetentionDays'))).toBe(true);
  });

  test('invalid privacy.privacyPolicyUrl', () => {
    const cfg = makeValidConfig({privacy: {privacyPolicyUrl: 'not-a-url'}});
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('privacyPolicyUrl'))).toBe(true);
  });

  test('invalid auth.type', () => {
    const cfg = makeValidConfig({auth: {enabled: true, type: 'face' as any}});
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('auth.type'))).toBe(true);
  });

  test('valid auth.type accepted', () => {
    for (const type of ['pin', 'biometric', 'both'] as const) {
      const cfg = makeValidConfig({auth: {enabled: true, type}});
      const result = validateConfig(cfg);
      expect(result.errors.filter(e => e.includes('auth.type'))).toHaveLength(0);
    }
  });

  test('invalid darkTheme color', () => {
    const cfg = makeValidConfig({
      theme: {
        primary: '#0047AB',
        secondary: '#FF6B00',
        background: '#F5F7FA',
        darkTheme: {background: 'not-hex'},
      },
    });
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('darkTheme.background'))).toBe(true);
  });

  test('i18n.strings with non-string value', () => {
    const cfg = makeValidConfig({i18n: {strings: {send: 123 as any}}});
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes('i18n.strings.send'))).toBe(true);
  });

  test('REST backend needs provider authentication', () => {
    const cfg = makeValidConfig({
      backend: {
        type: 'rest',
        baseUrl: 'https://bff.example',
        auth: {type: 'none'} as any,
      },
    });

    expect(validateConfig(cfg).errors).toContain(
      'backend.auth.type must be "provider" for a REST backend',
    );
  });

  test('REST backend needs an HTTPS base URL', () => {
    const cfg = makeValidConfig({
      backend: {
        type: 'rest',
        baseUrl: 'http://bff.example',
        auth: {type: 'provider'} as any,
      },
    });

    expect(validateConfig(cfg).errors).toContain(
      'backend.baseUrl must be an HTTPS URL for a REST backend',
    );
  });

  test('REST knowledge sync needs a pinned public key', () => {
    const cfg = makeValidConfig({
      backend: {
        type: 'rest',
        baseUrl: 'https://bff.example',
        auth: {type: 'provider', audience: 'airgap-bff'},
      },
    });

    expect(validateConfig(cfg).errors).toContain(
      'backend.sync.publicKeys must contain at least one pinned key',
    );
  });

  test('cloud mode needs an endpoint or REST backend URL', () => {
    const cfg = makeValidConfig({
      llm: {mode: 'prefer-online', cloud: {enabled: true}},
    });

    expect(validateConfig(cfg).errors).toContain('llm.cloud needs an endpoint or backend.baseUrl');
  });

  test('queue retries stay within the supported range', () => {
    const cfg = makeValidConfig({queue: {maxRetries: 0}});

    expect(validateConfig(cfg).errors).toContain(
      'queue.maxRetries must be an integer from 1 through 10',
    );
  });
});
