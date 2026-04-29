// Test the i18n utility function
// Note: This tests the t() function directly using a mock config

describe('i18n t() function', () => {
  let t: (key: string, fallback: string) => string;

  beforeAll(() => {
    // Mock the config module before importing t()
    jest.mock('../src/config/loader', () => ({
      i18nConfig: {
        strings: {
          send: 'Enviar',
          settings: 'Configuracion',
          clearChat: 'Borrar conversacion',
        },
      },
    }));

    // Import after mock is set up
    const i18n = require('../src/utils/i18n');
    t = i18n.t;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('returns override when key exists', () => {
    expect(t('send', 'Send')).toBe('Enviar');
    expect(t('settings', 'Settings')).toBe('Configuracion');
  });

  test('returns fallback when key does not exist', () => {
    expect(t('nonexistent', 'Fallback')).toBe('Fallback');
    expect(t('about', 'About')).toBe('About');
  });

  test('returns fallback for empty override key', () => {
    expect(t('', 'Default')).toBe('Default');
  });
});

describe('i18n with empty config', () => {
  let t: (key: string, fallback: string) => string;

  beforeAll(() => {
    jest.resetModules();
    jest.mock('../src/config/loader', () => ({
      i18nConfig: {strings: {}},
    }));
    const i18n = require('../src/utils/i18n');
    t = i18n.t;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('all keys return fallback with empty strings', () => {
    expect(t('send', 'Send')).toBe('Send');
    expect(t('settings', 'Settings')).toBe('Settings');
    expect(t('clearChat', 'Clear Chat')).toBe('Clear Chat');
  });
});
