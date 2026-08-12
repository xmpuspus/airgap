/**
 * Sync integration test — verifies the end-to-end file → memory → search
 * path that was broken in the 2026-04-09 session. Before the fix,
 * syncService.swapBundle wrote bundle-current.json to DocumentDirectoryPath
 * but searchService loaded compiled-in KB files at module import time, so
 * the user never saw synced content. This test guards against that
 * regression.
 */

// --- Mocks ---
// Jest hoists jest.mock factories to the top of the file, so variables
// referenced inside the factory MUST be prefixed with `mock` (case insensitive).
// We store the current bundle contents on a mock-prefixed holder object so
// individual tests can mutate them.

const mockFsState: {current: string | null; previous: string | null} = {
  current: null,
  previous: null,
};

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/airgap-test-integ',
  exists: jest.fn(async (path: string) => {
    if (path.endsWith('/kb/bundle-current.json')) {
      return mockFsState.current !== null;
    }
    if (path.endsWith('/kb/bundle-previous.json')) {
      return mockFsState.previous !== null;
    }
    return false;
  }),
  readFile: jest.fn(async (path: string) => {
    if (path.endsWith('/kb/bundle-current.json')) {
      if (mockFsState.current === null) throw new Error('ENOENT');
      return mockFsState.current;
    }
    if (path.endsWith('/kb/bundle-previous.json')) {
      if (mockFsState.previous === null) throw new Error('ENOENT');
      return mockFsState.previous;
    }
    throw new Error('ENOENT');
  }),
  mkdir: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({size: 0})),
  unlink: jest.fn(async () => undefined),
  moveFile: jest.fn(async () => undefined),
  hash: jest.fn(async () => 'sha256'),
  downloadFile: jest.fn(() => ({jobId: 1, promise: Promise.resolve({statusCode: 200})})),
}));

jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());

import {loadBundleIntoKnowledge, getKbSource} from '../src/services/syncService';
import {searchKB} from '../src/services/searchService';
import {getKnowledgeSource, getAllDocuments, revertToCompiledKnowledge} from '../src/knowledge';

function makeBundle(docs: Array<{id: string; title: string; keywords: string[]}>): string {
  const fullDocs = docs.map(d => ({
    id: d.id,
    category: 'faq',
    title: d.title,
    content: `${d.title} content body with the unique phrase ${d.id}.`,
    keywords: d.keywords,
    tags: [],
    metadata: {},
  }));
  return JSON.stringify({
    files: {
      'faq.json': JSON.stringify(fullDocs),
    },
    generatedAt: '2026-04-09T00:00:00.000Z',
  });
}

beforeEach(() => {
  mockFsState.current = null;
  mockFsState.previous = null;
  revertToCompiledKnowledge();
});

describe('sync integration: bundle → memory → search', () => {
  test('loadBundleIntoKnowledge no-ops when no bundle on disk', async () => {
    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('compiled');
    expect(getKnowledgeSource()).toBe('compiled');
  });

  test('loadBundleIntoKnowledge rebuilds index from a valid bundle on disk', async () => {
    mockFsState.current = makeBundle([
      {id: 'integ-test-1', title: 'Integration Test Doc', keywords: ['zebraphrase']},
      {id: 'integ-test-2', title: 'Second Doc', keywords: ['unicornphrase']},
    ]);

    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('bundle');
    expect(getKnowledgeSource()).toBe('bundle');

    const docs = getAllDocuments();
    const ids = docs.map(d => d.id);
    expect(ids).toContain('integ-test-1');
    expect(ids).toContain('integ-test-2');

    // MiniSearch rebuild — the new docs must be findable.
    const hits = searchKB('zebraphrase');
    expect(hits.some(h => h.id === 'integ-test-1')).toBe(true);
  });

  test('malformed bundle rolls back and reverts to compiled-in KB', async () => {
    mockFsState.current = 'not-valid-json{{{';
    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('compiled');
    expect(getKnowledgeSource()).toBe('compiled');

    // The compiled-in KB must still be searchable.
    const docs = getAllDocuments();
    expect(docs.length).toBeGreaterThan(0);
  });

  test('bundle with empty files falls back to compiled-in KB', async () => {
    mockFsState.current = JSON.stringify({files: {}, generatedAt: 'now'});
    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('compiled');
  });

  test('bundle with no files key fails cleanly', async () => {
    mockFsState.current = JSON.stringify({generatedAt: 'now'});
    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('compiled');
  });

  test('getKbSource reports bundle + version after successful load', async () => {
    mockFsState.current = makeBundle([
      {id: 'integ-test-99', title: 'Version Check', keywords: ['tagaloguniq']},
    ]);
    await loadBundleIntoKnowledge();
    const kbSource = getKbSource();
    expect(kbSource.source).toBe('bundle');
  });

  test('malformed current bundle recovers from previous bundle if available', async () => {
    mockFsState.current = 'broken';
    mockFsState.previous = makeBundle([
      {id: 'prev-1', title: 'Previous Doc', keywords: ['prevuniq']},
    ]);
    const result = await loadBundleIntoKnowledge();
    expect(result.source).toBe('bundle');
    const hits = searchKB('prevuniq');
    expect(hits.some(h => h.id === 'prev-1')).toBe(true);
  });
});
