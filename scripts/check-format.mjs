import {spawnSync} from 'node:child_process';

const supported = /\.(?:js|json|md|mjs|ts|tsx|ya?ml)$/;

function git(args) {
  const result = spawnSync('git', args, {encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim() : '';
}

const workingFiles = [
  ...git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']).split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
].filter(Boolean);

let files = workingFiles;
if (files.length === 0) {
  const baseRef = process.env.GITHUB_BASE_REF;
  const base = baseRef
    ? git(['merge-base', 'HEAD', `origin/${baseRef}`])
    : git(['rev-parse', 'HEAD^']);
  files = base ? git(['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD']).split('\n') : [];
}

files = [...new Set(files.filter(file => supported.test(file)))];
if (files.length === 0) {
  process.stdout.write('No changed text files need a format check.\n');
  process.exit(0);
}

const check = spawnSync('npx', ['prettier', '--check', ...files], {
  stdio: 'inherit',
});
process.exit(check.status ?? 1);
