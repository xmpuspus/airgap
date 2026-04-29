/**
 * web/data/build.mjs smoke test — runs the actual builder against the
 * real examples/ tree and asserts the output shape. Catches schema
 * regressions when an example config drops a required field.
 */

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'web', 'data', 'build.mjs');

const VERTICALS = [
  'airline',
  'banking',
  'electric-utility',
  'healthcare',
  'insurance',
  'telco',
  'water-utility',
];

beforeAll(() => {
  execFileSync('node', [SCRIPT], {cwd: ROOT, encoding: 'utf8'});
});

describe('web/data/build.mjs', () => {
  test('produces one JSON file per known vertical plus a manifest', () => {
    const dir = path.join(ROOT, 'web', 'data');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files).toEqual(
      expect.arrayContaining([
        ...VERTICALS.map(v => `${v}.json`),
        'manifest.json',
      ]),
    );
  });

  test('each vertical JSON carries the fields the showcase reads', () => {
    for (const v of VERTICALS) {
      const data = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'web', 'data', `${v}.json`), 'utf8'),
      );
      expect(data.vertical).toBe(v);
      expect(typeof data.label).toBe('string');
      expect(data.label.length).toBeGreaterThan(0);
      expect(data.theme.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(data.knowledge.totalDocs).toBeGreaterThan(0);
      expect(data.gif).toMatch(/^assets\/gifs\/industry-/);
      expect(data.config).toBeDefined();
      expect(data.config.brand).toBeDefined();
      expect(data.config.theme.primary).toBe(data.theme.primary);
    }
  });

  test('the manifest summarises every vertical', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'web', 'data', 'manifest.json'), 'utf8'),
    );
    expect(manifest.verticals).toHaveLength(VERTICALS.length);
    const slugs = manifest.verticals.map(v => v.vertical).sort();
    expect(slugs).toEqual([...VERTICALS].sort());
  });

  test('demo GIFs land in web/assets/gifs after a build', () => {
    const dir = path.join(ROOT, 'web', 'assets', 'gifs');
    const gifs = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => f.endsWith('.gif'))
      : [];
    expect(gifs.length).toBe(VERTICALS.length);
  });

  test('per-vertical config snippet has no LinkedIn or marketing language', () => {
    for (const v of VERTICALS) {
      const raw = fs.readFileSync(
        path.join(ROOT, 'web', 'data', `${v}.json`),
        'utf8',
      );
      expect(raw.toLowerCase()).not.toContain('linkedin');
      expect(raw.toLowerCase()).not.toContain('demo reel');
      expect(raw.toLowerCase()).not.toContain('wow factor');
    }
  });
});
