import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const repositoryRoot = resolve(scriptDir, '../../..');
const templateRoot = join(packageRoot, 'template');
const excludedSegments = new Set([
  'node_modules',
  'build',
  'Pods',
  '.gradle',
  '.cxx',
  '.kotlin',
  'coverage',
  'tmp',
]);

function shouldCopy(source) {
  const segments = relative(repositoryRoot, source).split(sep);
  return !segments.some(segment => excludedSegments.has(segment) || segment === '.DS_Store');
}

const directories = ['android', 'assets', 'examples', 'ios', 'scripts', 'src'];
const files = [
  '.editorconfig',
  '.eslintrc.js',
  '.prettierrc.json',
  '.watchmanconfig',
  'Gemfile',
  'LICENSE',
  'airgap.config.json',
  'airgap.schema.json',
  'app.json',
  'babel.config.js',
  'index.js',
  'metro.config.js',
  'package-lock.json',
  'package.json',
  'tsconfig.json',
];

await rm(templateRoot, {recursive: true, force: true});
await mkdir(templateRoot, {recursive: true});

for (const directory of directories) {
  await cp(join(repositoryRoot, directory), join(templateRoot, directory), {
    recursive: true,
    filter: shouldCopy,
  });
}
for (const file of files) {
  await cp(join(repositoryRoot, file), join(templateRoot, file));
}

const packagePath = join(templateRoot, 'package.json');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
delete packageJson.workspaces;
packageJson.private = true;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const lockPath = join(templateRoot, 'package-lock.json');
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
delete lock.packages[''].workspaces;
for (const key of Object.keys(lock.packages)) {
  if (key === 'node_modules/create-airgap-bot' || key.startsWith('packages/create-airgap-bot')) {
    delete lock.packages[key];
  }
}
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

process.stdout.write(`Built packaged template at ${templateRoot}\n`);
