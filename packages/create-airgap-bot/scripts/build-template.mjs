import {execFile} from 'node:child_process';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const repositoryRoot = resolve(scriptDir, '../../..');
const templateRoot = join(packageRoot, 'template');
const execFileAsync = promisify(execFile);
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

async function trackedSourcePaths() {
  const {stdout} = await execFileAsync(
    'git',
    ['-C', repositoryRoot, 'ls-files', '-z', '--', ...directories, ...files],
    {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
  );
  const paths = new Set();
  for (const file of stdout.split('\0').filter(Boolean)) {
    const segments = file.split('/');
    for (let length = 1; length <= segments.length; length++) {
      paths.add(segments.slice(0, length).join('/'));
    }
  }
  if (paths.size === 0) {
    throw new Error('Cannot build the packaged template without version-controlled sources');
  }
  return paths;
}

const trackedPaths = await trackedSourcePaths();

function shouldCopy(source) {
  const pathFromRoot = relative(repositoryRoot, source).split(sep).join('/');
  const segments = pathFromRoot.split('/');
  return (
    trackedPaths.has(pathFromRoot) &&
    !segments.some(segment => excludedSegments.has(segment) || segment === '.DS_Store')
  );
}

await rm(templateRoot, {recursive: true, force: true});
await mkdir(templateRoot, {recursive: true});

for (const directory of directories) {
  await cp(join(repositoryRoot, directory), join(templateRoot, directory), {
    recursive: true,
    filter: shouldCopy,
  });
}
for (const file of files) {
  if (!trackedPaths.has(file)) {
    throw new Error(`Template source is not version controlled: ${file}`);
  }
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
