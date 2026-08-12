// render-table.test.js
//
// Fixture-based test for bench/render-table.mjs. Each test creates a
// throwaway directory under `os.tmpdir()`, drops a synthetic README and
// (optionally) a few result JSON files into it, runs the script with
// `--root <fixture>`, and asserts on the resulting README contents.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', '..', 'bench', 'render-table.mjs');
const NODE = process.execPath;

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-render-'));
  fs.mkdirSync(path.join(dir, 'bench', 'results'), {recursive: true});
  return dir;
}

function writeReadme(dir, body) {
  fs.writeFileSync(path.join(dir, 'README.md'), body);
}

function readReadme(dir) {
  return fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
}

function writeResult(dir, name, payload) {
  const target = path.join(dir, 'bench', 'results', name);
  fs.writeFileSync(target, JSON.stringify(payload, null, 2));
}

function runScript(dir) {
  return execFileSync(NODE, [SCRIPT, '--root', dir], {encoding: 'utf8'});
}

const READMES_FRAME =
  'Top of file.\n' +
  '\n' +
  '## Benchmarks\n' +
  '\n' +
  'Some prose.\n' +
  '\n' +
  '<!-- BENCH START -->\n' +
  'placeholder\n' +
  '<!-- BENCH END -->\n' +
  '\n' +
  'Footer.\n';

describe('bench/render-table.mjs', () => {
  test('writes empty placeholder row when no results are present', () => {
    const dir = makeFixture();
    writeReadme(dir, READMES_FRAME);
    runScript(dir);
    const out = readReadme(dir);
    expect(out).toContain('<!-- BENCH START -->');
    expect(out).toContain('<!-- BENCH END -->');
    expect(out).toContain('No benchmark data yet');
    expect(out).toContain('run bench/run-node.sh to populate');
    // Footer must still be present (markers preserved, file not truncated)
    expect(out).toContain('Footer.');
  });

  test('is idempotent across two consecutive runs', () => {
    const dir = makeFixture();
    writeReadme(dir, READMES_FRAME);
    writeResult(dir, 'pixel-8-pro-20260101T120000Z.json', {
      device: 'Pixel 8 Pro',
      mode: 'real',
      model: 'Gemma 4 E2B Q3_K_S',
      first_token_ms_p50: 410,
      tokens_per_sec_p50: 7.2,
      cold_load_ms: 2100,
      notes: '12 GB RAM',
    });
    runScript(dir);
    const first = readReadme(dir);
    runScript(dir);
    const second = readReadme(dir);
    expect(second).toBe(first);
  });

  test('takes newest run per device when multiple result files exist', () => {
    const dir = makeFixture();
    writeReadme(dir, READMES_FRAME);
    writeResult(dir, 'pixel-8-pro-20260101T120000Z.json', {
      device: 'Pixel 8 Pro',
      mode: 'real',
      model: 'Gemma 4 E2B Q3_K_S',
      first_token_ms_p50: 999,
      tokens_per_sec_p50: 1.0,
      cold_load_ms: 9000,
      notes: 'OLD RUN',
    });
    writeResult(dir, 'pixel-8-pro-20260301T120000Z.json', {
      device: 'Pixel 8 Pro',
      mode: 'real',
      model: 'Gemma 4 E2B Q3_K_S',
      first_token_ms_p50: 410,
      tokens_per_sec_p50: 7.2,
      cold_load_ms: 2100,
      notes: 'NEW RUN',
    });
    runScript(dir);
    const out = readReadme(dir);
    expect(out).toContain('NEW RUN');
    expect(out).not.toContain('OLD RUN');
  });

  test('sorts real-LLM rows alphabetically before demo rows', () => {
    const dir = makeFixture();
    writeReadme(dir, READMES_FRAME);
    writeResult(dir, 'iphone-16-pro-20260101T120000Z.json', {
      device: 'iPhone 16 Pro',
      mode: 'demo',
      model: 'n/a',
      first_token_ms_p50: 12,
      tokens_per_sec_p50: null,
      cold_load_ms: 80,
      notes: 'demo formatter',
    });
    writeResult(dir, 'pixel-8-pro-20260101T120000Z.json', {
      device: 'Pixel 8 Pro',
      mode: 'real',
      model: 'Gemma 4 E2B Q3_K_S',
      first_token_ms_p50: 410,
      tokens_per_sec_p50: 7.2,
      cold_load_ms: 2100,
      notes: 'real LLM',
    });
    writeResult(dir, 'galaxy-s24-20260101T120000Z.json', {
      device: 'Galaxy S24',
      mode: 'real',
      model: 'Gemma 4 E2B Q3_K_S',
      first_token_ms_p50: 480,
      tokens_per_sec_p50: 6.4,
      cold_load_ms: 2400,
      notes: 'real LLM',
    });
    runScript(dir);
    const out = readReadme(dir);
    const galaxyIdx = out.indexOf('Galaxy S24');
    const pixelIdx = out.indexOf('Pixel 8 Pro');
    const iphoneIdx = out.indexOf('iPhone 16 Pro');
    expect(galaxyIdx).toBeGreaterThan(-1);
    expect(pixelIdx).toBeGreaterThan(-1);
    expect(iphoneIdx).toBeGreaterThan(-1);
    // real rows alphabetical: Galaxy < Pixel
    expect(galaxyIdx).toBeLessThan(pixelIdx);
    // demo row last
    expect(pixelIdx).toBeLessThan(iphoneIdx);
    // demo tokens/sec is "n/a (demo)"
    expect(out).toContain('n/a (demo)');
  });

  test('preserves marker lines and surrounding content', () => {
    const dir = makeFixture();
    writeReadme(dir, READMES_FRAME);
    runScript(dir);
    const out = readReadme(dir);
    expect(out.startsWith('Top of file.\n')).toBe(true);
    expect(out.endsWith('Footer.\n')).toBe(true);
    expect((out.match(/<!-- BENCH START -->/g) || []).length).toBe(1);
    expect((out.match(/<!-- BENCH END -->/g) || []).length).toBe(1);
  });

  test('exits non-zero when markers are missing', () => {
    const dir = makeFixture();
    writeReadme(dir, 'No markers in this README.\n');
    let threw = false;
    try {
      execFileSync(NODE, [SCRIPT, '--root', dir], {encoding: 'utf8'});
    } catch (err) {
      threw = true;
      expect(err.status).toBe(1);
    }
    expect(threw).toBe(true);
  });
});
