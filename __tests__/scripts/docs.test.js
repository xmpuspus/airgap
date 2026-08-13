const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {extractLocalTargets, findBrokenMarkdownLinks} = require('../../scripts/lib/docs.js');

describe('documentation links', () => {
  test('extracts repository files and images but ignores external and fenced examples', () => {
    const markdown = [
      '[setup](../DEPLOYMENT.md)',
      '![demo](../demo/example.gif)',
      '[section](#local-heading)',
      '[website](https://example.com)',
      '```md',
      '[example](missing.md)',
      '```',
      '<img src="../assets/logo.svg" alt="Logo" />',
    ].join('\n');

    expect(extractLocalTargets(markdown)).toEqual([
      '../DEPLOYMENT.md',
      '../demo/example.gif',
      '../assets/logo.svg',
    ]);
  });

  test('reports a missing relative target with its source document', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airgap-docs-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'README.md'), '[guide](docs/guide.md)');
    fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '[missing](missing.md)');

    try {
      expect(findBrokenMarkdownLinks(root)).toEqual([
        {
          source: 'docs/guide.md',
          target: 'missing.md',
          resolved: 'docs/missing.md',
        },
      ]);
    } finally {
      fs.rmSync(root, {recursive: true, force: true});
    }
  });

  test('all checked-in documentation references existing local paths', () => {
    expect(findBrokenMarkdownLinks(process.cwd())).toEqual([]);
  });

  test('exposes the documentation check as a repository command', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts['docs:check']).toBe('node scripts/check-docs.mjs');
    expect(fs.existsSync(path.join(process.cwd(), 'scripts', 'check-docs.mjs'))).toBe(true);
  });
});
