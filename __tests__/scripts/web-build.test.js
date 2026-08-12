/**
 * web/data/build.mjs smoke test runs the actual builder against the
 * real examples/ tree and asserts the output shape. Catches schema
 * regressions when an example config drops a required field.
 */

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'web', 'data', 'build.mjs');
const README = path.join(ROOT, 'README.md');
const INDEX = path.join(ROOT, 'web', 'index.html');
const STYLES = path.join(ROOT, 'web', 'styles.css');

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
      expect.arrayContaining([...VERTICALS.map(v => `${v}.json`), 'manifest.json']),
    );
  });

  test('each vertical JSON carries the fields the project site reads', () => {
    for (const v of VERTICALS) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'data', `${v}.json`), 'utf8'));
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

  test('the build output is deterministic', () => {
    const manifestPath = path.join(ROOT, 'web', 'data', 'manifest.json');
    const first = fs.readFileSync(manifestPath, 'utf8');
    execFileSync('node', [SCRIPT], {cwd: ROOT, encoding: 'utf8'});
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(first);
  });

  test('demo GIFs land in web/assets/gifs after a build', () => {
    const dir = path.join(ROOT, 'web', 'assets', 'gifs');
    const gifs = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => f.startsWith('industry-') && f.endsWith('.gif'))
      : [];
    expect(gifs.length).toBe(VERTICALS.length);
  });

  test('the primary app recording lands beside the industry recordings', () => {
    expect(fs.existsSync(path.join(ROOT, 'web', 'assets', 'gifs', 'airgap-demo.gif'))).toBe(true);
  });

  test('per-vertical config snippet has no LinkedIn or marketing language', () => {
    for (const v of VERTICALS) {
      const raw = fs.readFileSync(path.join(ROOT, 'web', 'data', `${v}.json`), 'utf8');
      expect(raw.toLowerCase()).not.toContain('linkedin');
      expect(raw.toLowerCase()).not.toContain('demo reel');
      expect(raw.toLowerCase()).not.toContain('wow factor');
    }
  });

  test('README gives one current CLI path and one primary recording', () => {
    const readme = fs.readFileSync(README, 'utf8');
    expect(readme).toContain('npx create-airgap-bot support-app --template telco');
    expect(readme.match(/demo\/airgap-readme-side-by-side\.gif/g) ?? []).toHaveLength(1);
    expect(readme.toLowerCase()).not.toContain('coming soon');
    expect(readme.toLowerCase()).not.toContain('coming once');
  });

  test('site states current behavior and includes the provenance example', () => {
    const html = fs.readFileSync(INDEX, 'utf8');
    expect(html).toContain('npx create-airgap-bot support-app --template telco');
    expect(html).toContain('class="answer-provenance"');
    expect(html).toContain('Signed knowledge updates');
    expect(html.toLowerCase()).not.toContain('coming soon');
    expect(html.toLowerCase()).not.toContain('coming once');
  });

  test('site supports keyboard focus, reduced motion, and 320-pixel screens', () => {
    const css = fs.readFileSync(STYLES, 'utf8');
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
  });

  test('template cards can shrink to the mobile viewport', () => {
    const css = fs.readFileSync(STYLES, 'utf8');

    expect(css).toMatch(/\.template-grid\s*>\s*\*\s*{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.template-picker\s*>\s*\*\s*{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.template-picker\s+code\s*{[^}]*overflow-wrap:\s*anywhere/s);
  });

  test('README local links resolve inside the repository', () => {
    const readme = fs.readFileSync(README, 'utf8');
    const targets = [...readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
      .map(match => match[1])
      .filter(target => !/^(?:https?:|mailto:|#)/.test(target));
    const missing = targets.filter(target => {
      const pathname = decodeURIComponent(target.split('#')[0]);
      if (
        pathname === 'demo/airgap-readme-side-by-side.gif' &&
        !fs.existsSync(path.join(ROOT, 'demo', 'recordings.json'))
      ) {
        return false;
      }
      return !fs.existsSync(path.join(ROOT, pathname));
    });
    expect(missing).toEqual([]);
  });

  test('site local assets resolve inside the web directory', () => {
    const html = fs.readFileSync(INDEX, 'utf8');
    const targets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map(match => match[1])
      .filter(target => !/^(?:https?:|mailto:|#)/.test(target));
    const missing = targets.filter(target => !fs.existsSync(path.join(ROOT, 'web', target)));
    expect(missing).toEqual([]);
  });
});
