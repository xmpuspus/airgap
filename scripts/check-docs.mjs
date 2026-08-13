#!/usr/bin/env node

import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {findBrokenMarkdownLinks} = require('./lib/docs.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = findBrokenMarkdownLinks(root);

if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`${problem.source}: ${problem.target} -> ${problem.resolved}\n`);
  }
  process.stderr.write(`Found ${problems.length} broken local documentation link(s).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('All local documentation links resolve.\n');
}
