const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('web/index.html');
const plain = text =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('public showcase entry points', () => {
  test('the landing page explains every approved feature and links its recorded demo', () => {
    const recordings = JSON.parse(read('demo/public-service/recordings.json')).recordings;
    expect(recordings).toHaveLength(5);
    for (const recording of recordings) {
      const article = html.match(
        new RegExp(`<article[^>]*data-feature="${recording.feature}"[^>]*>([\\s\\S]*?)</article>`),
      )?.[1];
      expect(article).toBeDefined();
      expect(plain(article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')).not.toBe('');
      expect(plain(article.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '').length).toBeGreaterThan(40);
      expect(article).toContain(`assets/gifs/public-service/${path.basename(recording.output)}`);
      expect(article).toContain(`assets/gifs/public-service/${path.basename(recording.shareMp4)}`);
    }
  });

  test('a visitor can find the live lab, first run, replay, reproduction and contribution guide', () => {
    expect(html).toMatch(/href="lab.html"/);
    expect(plain(html)).toContain('node scripts/public-service.mjs replay --json');
    expect(plain(html)).toContain('npm run public:demo -- --model');
    expect(html).toContain('docs/public-service-showcase.md');
    expect(plain(html)).toMatch(/first run/i);
    expect(plain(html)).toMatch(/contribut/i);
    expect(plain(html)).toMatch(/recorded.*model|model.*recorded/i);
    expect(plain(html)).toMatch(/no agency transaction/i);
  });

  test('the visible template count matches the generated manifest', () => {
    const manifest = JSON.parse(read('web/data/manifest.json'));
    const count = html.match(/<strong>(\d+)<\/strong>\s*<span>industry templates<\/span>/);
    expect(count).not.toBeNull();
    expect(Number(count[1])).toBe(manifest.verticals.length);
  });

  test('verification directs readers to current Jest output instead of a drifting test total', () => {
    const row = read('evidence/public-service/verification.md')
      .split('\n')
      .find(line => /^\| Jest\s*\|/.test(line));
    expect(row).toBeDefined();
    expect(row).toContain('npm test -- --runInBand');
    expect(row).not.toMatch(/\d+ (?:tests|suites)/);
  });

  test('the recording guide reflects the reviewed replacement media and links their evidence', () => {
    const guide = read('docs/recordings.md').split('## Needed tools')[0];
    const manifest = JSON.parse(read('demo/public-service/recordings.json'));
    const review = read('evidence/public-service/visual-review.md');
    expect(manifest.recordings).toHaveLength(5);
    for (const recording of manifest.recordings) {
      const digest = createHash('sha256')
        .update(fs.readFileSync(path.join(root, recording.output)))
        .digest('hex');
      expect(recording.loopReviewed).toBe(true);
      expect(digest).toBe(recording.sha256);
      expect(review).toContain(digest);
    }
    expect(guide).not.toMatch(/remain unapproved|require replacement/i);
    expect(guide).toContain('(../demo/public-service/recordings.json)');
    expect(guide).toContain('(../evidence/public-service/visual-review.md)');
    expect(guide).toContain('(../evidence/public-service/reproduction-review.md)');
  });
});
