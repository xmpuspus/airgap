// Tests for search service utilities (negation, category boosting, re-ranking)
// These test the exported pure functions without needing the full MiniSearch index

describe('extractNegatedTerms', () => {
  let extractNegatedTerms: (query: string) => string[];

  beforeAll(() => {
    // Mock dependencies that searchService imports
    jest.mock('../src/knowledge', () => ({
      getSearchIndex: () => ({search: () => []}),
      getAllDocuments: () => [],
      getDocumentById: () => undefined,
      getKnowledgeSource: () => 'compiled',
      getLoadedBundleVersion: () => null,
      replaceKnowledgeFromBundle: jest.fn(),
      revertToCompiledKnowledge: jest.fn(),
    }));
    jest.mock('../src/config/loader', () => ({
      config: {knowledge: {search: {topK: 3}}},
    }));
    jest.mock('../src/services/logger', () => ({
      logger: {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()},
    }));

    const service = require('../src/services/searchService');
    extractNegatedTerms = service.extractNegatedTerms;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('extracts "not X" pattern', () => {
    expect(extractNegatedTerms('not postpaid')).toContain('postpaid');
  });

  test('extracts "don\'t want X" pattern', () => {
    expect(extractNegatedTerms("I don't want postpaid")).toContain('postpaid');
  });

  test('extracts "without X" pattern', () => {
    expect(extractNegatedTerms('plans without data')).toContain('data');
  });

  test('extracts "exclude X" pattern', () => {
    expect(extractNegatedTerms('exclude roaming')).toContain('roaming');
  });

  test('extracts "no X" pattern', () => {
    expect(extractNegatedTerms('no contract plans')).toContain('contract');
  });

  test.each([
    'no signal',
    'my phone is not working',
    'no internet',
    'no service',
    'page not loading',
  ])('ignores the symptom phrase "%s"', query => {
    expect(extractNegatedTerms(query)).toEqual([]);
  });

  test('keeps an exclusion that follows a symptom phrase', () => {
    expect(extractNegatedTerms('no signal, no contract plans')).toEqual(['contract']);
  });

  test('returns empty for query without negation', () => {
    expect(extractNegatedTerms('what plans do you have')).toHaveLength(0);
  });

  test('deduplicates negated terms', () => {
    const terms = extractNegatedTerms('not postpaid, no postpaid');
    const unique = [...new Set(terms)];
    expect(terms.length).toBe(unique.length);
  });
});

describe('searchKB', () => {
  let searchKB: (query: string, options?: any) => any[];

  beforeAll(() => {
    jest.resetModules();

    // Provide mock search results
    const mockDocs = [
      {
        id: 'faq-0',
        category: 'faq',
        title: 'Explain charges',
        content: 'About charges',
        keywords: ['charges'],
        tags: [],
      },
      {
        id: 'plan-1',
        category: 'plan',
        title: 'Plan 299',
        content: 'Prepaid plan',
        keywords: ['prepaid'],
        tags: ['budget'],
        metadata: {price: 299},
      },
      {
        id: 'plan-2',
        category: 'plan',
        title: 'Plan 999',
        content: 'Postpaid plan',
        keywords: ['postpaid'],
        tags: ['premium'],
        metadata: {price: 999},
      },
      {
        id: 'plan-3',
        category: 'plan',
        title: 'Plan 599',
        content: 'Mid-range plan',
        keywords: ['mid'],
        tags: [],
        metadata: {price: 599},
      },
      {
        id: 'faq-1',
        category: 'faq',
        title: 'Balance check',
        content: 'How to check',
        keywords: ['balance'],
        tags: [],
      },
    ];

    jest.mock('../src/knowledge', () => ({
      getSearchIndex: () => ({
        search: () => mockDocs.map(d => ({...d, score: 1})),
      }),
      getAllDocuments: () => mockDocs,
      getDocumentById: (id: string) => mockDocs.find(d => d.id === id),
      getKnowledgeSource: () => 'compiled',
      getLoadedBundleVersion: () => null,
      replaceKnowledgeFromBundle: jest.fn(),
      revertToCompiledKnowledge: jest.fn(),
    }));
    jest.mock('../src/config/loader', () => ({
      config: {knowledge: {search: {topK: 3}}},
    }));
    jest.mock('../src/services/logger', () => ({
      logger: {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()},
    }));

    const service = require('../src/services/searchService');
    searchKB = service.searchKB;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('returns results limited by topK', () => {
    const results = searchKB('plans', {topK: 2});
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('sorts unpriced records last for a cheapest query', () => {
    const ids = searchKB('cheapest', {topK: 5}).map(r => r.id);
    expect(ids.slice(0, 3)).toEqual(['plan-1', 'plan-3', 'plan-2']);
  });

  test('sorts unpriced records last for a most expensive query', () => {
    const ids = searchKB('most expensive', {topK: 5}).map(r => r.id);
    expect(ids.slice(0, 3)).toEqual(['plan-2', 'plan-3', 'plan-1']);
  });

  test('matches category signals as whole words', () => {
    // "airplane" contains "plan" but is not the word "plan"
    expect(searchKB('airplane charges', {topK: 5})[0].id).toBe('faq-0');
  });

  test('boosts the category for a whole-word signal', () => {
    expect(searchKB('which plan', {topK: 5})[0].category).toBe('plan');
  });

  test('returns results with required fields', () => {
    const results = searchKB('plan');
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('category');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('content');
    }
  });
});
