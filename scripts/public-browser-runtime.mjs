import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root} from './public-service.mjs';

export function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.error})`);
}

export function requireCommittedCaptureSource() {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'});
  if (head.status !== 0) throw new Error('Capture requires a source commit');
  const files = JSON.parse(
    fs.readFileSync(path.join(root, 'validation/public-service-lineage.json'), 'utf8'),
  );
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const file of files) {
    if (['web/data/public-service.json', 'evidence/public-service/experiment.json'].includes(file))
      continue;
    const committed = spawnSync('git', ['show', `${head.stdout.trim()}:${file}`], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (
      committed.status !== 0 ||
      hash(committed.stdout) !== hash(fs.readFileSync(path.join(root, file)))
    )
      throw new Error(`Commit reviewed source before capture: ${file}`);
  }
}

export function mediaRuntime() {
  for (const command of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(command, ['-version'], {cwd: root, encoding: 'utf8'});
    if (result.status !== 0)
      throw new Error(
        `Install ${command} before capture or inference: ${result.error ?? result.stderr}`,
      );
  }
}

export function browserRuntime() {
  const probe = `import importlib.metadata, pathlib, sys
try:
    version = importlib.metadata.version('playwright')
except importlib.metadata.PackageNotFoundError:
    sys.exit(42)
if version != '1.58.0':
    sys.exit(42)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    sys.exit(0 if pathlib.Path(p.chromium.executable_path).is_file() else 42)
`;
  function installed(python, env = process.env) {
    const result = spawnSync(python, ['-c', probe], {cwd: root, env, encoding: 'utf8'});
    if (result.status === 42) return false;
    if (result.status !== 0)
      throw new Error(`Browser prerequisite probe failed: ${result.stderr || result.error}`);
    return true;
  }
  // Use an already installed pinned runtime when present. The probe neither
  // launches a browser nor treats a sandbox denial as missing dependencies.
  if (installed('python3')) {
    return {python: 'python3', env: process.env};
  }
  const directory = path.join(root, 'tmp/public-showcase/python');
  const python = path.join(directory, 'bin/python3');
  const env = {
    ...process.env,
    PIP_CACHE_DIR: path.join(root, 'tmp/public-showcase/pip-cache'),
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'tmp/public-showcase/browser-cache'),
  };
  if (!fs.existsSync(python)) run('python3', ['-m', 'venv', directory], env);
  if (!installed(python, env)) {
    run(python, ['-m', 'pip', 'install', '-r', 'scripts/public-requirements.txt'], env);
    run(python, ['-m', 'playwright', 'install', 'chromium'], env);
  }
  return {python, env};
}
