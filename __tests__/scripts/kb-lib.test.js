/**
 * Pure-function tests for the shared kb helpers extracted from
 * kb-validate.js + kb-import.js. Covers the parser, the validator, and
 * the category-split + export round-trip used by kb-studio.js.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  csvToDocs,
  parseCSV,
  parseCSVRow,
  splitByCategory,
  exportToDir,
  validateDocs,
  summarizeKB,
  safeFilename,
} = require('../../scripts/lib/kb');

describe('parseCSVRow', () => {
  test('splits unquoted fields on commas', () => {
    expect(parseCSVRow('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  test('handles quoted fields with embedded commas', () => {
    expect(parseCSVRow('"hello, world",foo')).toEqual(['hello, world', 'foo']);
  });
  test('decodes doubled quotes inside a quoted field', () => {
    expect(parseCSVRow('"she said ""hi""",bar')).toEqual(['she said "hi"', 'bar']);
  });
});

describe('parseCSV', () => {
  test('preserves blank lines outside quoted fields', () => {
    const rows = parseCSV('a,b\n1,2\n\n3,4');
    expect(rows).toHaveLength(3);
  });
  test('keeps newlines that fall inside a quoted field', () => {
    const rows = parseCSV('a,b\n1,"line1\nline2"\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('line1\nline2');
  });
});

describe('csvToDocs', () => {
  const HEADER = 'id,category,title,content,keywords,tags';

  test('converts a simple CSV into well-formed docs', () => {
    const csv = `${HEADER}\np-1,plan,Super 99,5GB for 7 days,plan;data,promo`;
    const {docs, skipped} = csvToDocs(csv);
    expect(skipped).toEqual([]);
    expect(docs).toEqual([
      {
        id: 'p-1',
        category: 'plan',
        title: 'Super 99',
        content: '5GB for 7 days',
        keywords: ['plan', 'data'],
        tags: ['promo'],
      },
    ]);
  });

  test('skips rows missing required fields and records the skip reason', () => {
    const csv = `${HEADER}\n,plan,Super 99,5GB,plan,promo\np-2,plan,Plan B,Body,plan,promo`;
    const {docs, skipped} = csvToDocs(csv);
    expect(docs).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('missing required field');
  });

  test('throws when a required column is absent from the header', () => {
    expect(() => csvToDocs('id,category,title\n1,plan,A')).toThrow(
      /Missing column/,
    );
  });

  test('throws when there are no data rows', () => {
    expect(() => csvToDocs(HEADER)).toThrow(/no data rows/);
  });
});

describe('validateDocs', () => {
  test('flags missing fields per row with the file label', () => {
    const errors = validateDocs(
      [{id: '1', category: 'p', title: 'T', content: 'C', keywords: ['x'], tags: []}, {}],
      'fixture.json',
    );
    expect(errors.some(e => e.includes('fixture.json[1]'))).toBe(true);
    expect(errors.some(e => e.includes('missing required field'))).toBe(true);
  });

  test('detects duplicate ids within a single payload', () => {
    const errors = validateDocs(
      [
        {id: 'dup', category: 'p', title: 'A', content: 'a', keywords: ['x'], tags: []},
        {id: 'dup', category: 'p', title: 'B', content: 'b', keywords: ['y'], tags: []},
      ],
      'inline',
    );
    expect(errors.some(e => e.includes("duplicate id 'dup'"))).toBe(true);
  });

  test('returns no errors for a valid doc list', () => {
    const errors = validateDocs(
      [
        {id: '1', category: 'p', title: 'A', content: 'a', keywords: ['x'], tags: []},
        {id: '2', category: 'p', title: 'B', content: 'b', keywords: ['y'], tags: ['z']},
      ],
      'inline',
    );
    expect(errors).toEqual([]);
  });
});

describe('splitByCategory + exportToDir', () => {
  test('writes one JSON file per category and returns the paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-lib-'));
    const docs = [
      {id: '1', category: 'plan', title: 'A', content: 'a', keywords: ['x'], tags: []},
      {id: '2', category: 'faq', title: 'B', content: 'b', keywords: ['y'], tags: []},
      {id: '3', category: 'plan', title: 'C', content: 'c', keywords: ['z'], tags: []},
    ];
    const grouped = splitByCategory(docs);
    expect([...grouped.keys()].sort()).toEqual(['faq', 'plan']);
    const files = exportToDir(grouped, tmp);
    expect(files).toHaveLength(2);
    const planContent = JSON.parse(fs.readFileSync(path.join(tmp, 'plan.json'), 'utf8'));
    expect(planContent).toHaveLength(2);
    expect(planContent.map(d => d.id).sort()).toEqual(['1', '3']);
  });
});

describe('safeFilename', () => {
  test('lowercases and strips unsafe characters', () => {
    expect(safeFilename('My Category!')).toBe('my_category_');
    expect(safeFilename('Plans / Promos')).toBe('plans___promos');
  });
});

describe('summarizeKB', () => {
  test('returns zeros for a missing dir', () => {
    expect(summarizeKB(path.join(os.tmpdir(), 'kb-lib-missing-' + Date.now()))).toEqual({
      totalDocs: 0,
      categories: {},
      files: 0,
      bytes: 0,
    });
  });

  test('counts docs per category across files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-lib-sum-'));
    fs.writeFileSync(
      path.join(tmp, 'plan.json'),
      JSON.stringify([{id: '1', category: 'plan', title: 'A', content: 'a', keywords: ['x'], tags: []}]),
    );
    fs.writeFileSync(
      path.join(tmp, 'faq.json'),
      JSON.stringify([{id: '2', category: 'faq', title: 'B', content: 'b', keywords: ['y'], tags: []}]),
    );
    const sum = summarizeKB(tmp);
    expect(sum.totalDocs).toBe(2);
    expect(sum.categories).toEqual({plan: 1, faq: 1});
    expect(sum.files).toBe(2);
    expect(sum.bytes).toBeGreaterThan(0);
  });
});
