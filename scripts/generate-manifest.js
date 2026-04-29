#!/usr/bin/env node
import { readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '..', 'src', 'knowledge');
const OUT_FILE = join(KNOWLEDGE_DIR, 'manifest.ts');

function toCamelCase(str) {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

const files = readdirSync(KNOWLEDGE_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

const names = files.map(f => toCamelCase(basename(f, '.json')));

const imports = files.map((f, i) => `import ${names[i]} from './${f}';`).join('\n');
const exports = names.map(n => `  ${n},`).join('\n');

const content = `/**
 * Knowledge Base Manifest (auto-generated)
 * Run: node scripts/generate-manifest.js
 */
${imports}

export const knowledgeFiles = {
${exports}
};
`;

writeFileSync(OUT_FILE, content);
console.log(`Generated manifest with ${files.length} file${files.length !== 1 ? 's' : ''}: ${files.join(', ')}`);
