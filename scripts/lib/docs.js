const fs = require('node:fs');
const path = require('node:path');

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'build',
  'DerivedData',
  'node_modules',
  'Pods',
  'template',
  'tmp',
]);

function withoutFencedCode(markdown) {
  return markdown.replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)\s*$/gm, '');
}

function isLocalTarget(target) {
  return (
    target &&
    !target.startsWith('#') &&
    !target.startsWith('//') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(target)
  );
}

function cleanTarget(target) {
  const unwrapped = target.replace(/^<|>$/g, '');
  const pathOnly = unwrapped.split('#', 1)[0].split('?', 1)[0];
  try {
    return decodeURIComponent(pathOnly);
  } catch {
    return pathOnly;
  }
}

function extractLocalTargets(markdown) {
  const content = withoutFencedCode(markdown);
  const targets = [];
  const markdownLink = /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+['"][^)]*['"])?\)/g;
  const htmlLink = /<(?:a|img)\b[^>]*(?:href|src)=["']([^"']+)["'][^>]*>/gi;

  for (const expression of [markdownLink, htmlLink]) {
    let match;
    while ((match = expression.exec(content)) !== null) {
      const target = cleanTarget(match[1]);
      if (isLocalTarget(target)) targets.push(target);
    }
  }
  return targets;
}

function markdownFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(absolute);
    }
  }
  visit(root);
  return files.sort();
}

function findBrokenMarkdownLinks(root) {
  const problems = [];
  for (const sourcePath of markdownFiles(root)) {
    const source = path.relative(root, sourcePath).split(path.sep).join('/');
    const markdown = fs.readFileSync(sourcePath, 'utf8');
    for (const target of extractLocalTargets(markdown)) {
      const resolvedPath = target.startsWith('/')
        ? path.join(root, target.slice(1))
        : path.resolve(path.dirname(sourcePath), target);
      if (!fs.existsSync(resolvedPath)) {
        problems.push({
          source,
          target,
          resolved: path.relative(root, resolvedPath).split(path.sep).join('/'),
        });
      }
    }
  }
  return problems;
}

module.exports = {extractLocalTargets, findBrokenMarkdownLinks};
