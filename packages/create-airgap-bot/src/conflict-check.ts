#!/usr/bin/env node
// Pre-publish conflict checker. It checks that the npm name is free or ours
// with a version that npm does not have yet, and that no standalone GitHub
// repository uses the package name. It exits non-zero on a conflict so the
// publish workflow stops before the publish step.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import process from 'node:process';
import pc from 'picocolors';

const execFileP = promisify(execFile);

interface CheckResult {
  source: 'npm' | 'github';
  name: string;
  status: 'available' | 'taken' | 'unknown';
  detail: string;
}

interface RegistryDocument {
  'dist-tags'?: {latest?: string};
  versions?: Record<string, unknown>;
  maintainers?: {name?: string}[];
}

interface PublishTarget {
  name: string;
  version: string;
  owner: string;
}

// A null document means the registry has no package with that name.
export function decideNpm(body: RegistryDocument | null, target: PublishTarget): CheckResult {
  const {name, version, owner} = target;
  if (body === null) {
    return {source: 'npm', name, status: 'available', detail: '404 from registry'};
  }
  const latest = body['dist-tags']?.latest ?? 'unknown';
  const maintainers = (body.maintainers ?? []).map(m => m.name ?? '').filter(Boolean);
  if (body.versions && Object.prototype.hasOwnProperty.call(body.versions, version)) {
    return {source: 'npm', name, status: 'taken', detail: `version ${version} is already on npm`};
  }
  if (maintainers.length > 0 && !maintainers.includes(owner)) {
    return {
      source: 'npm',
      name,
      status: 'taken',
      detail: `owned by ${maintainers.join(', ')}`,
    };
  }
  return {source: 'npm', name, status: 'available', detail: `ours, latest=${latest}`};
}

async function checkNpm(target: PublishTarget): Promise<CheckResult> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(target.name)}`);
    if (res.status === 404) return decideNpm(null, target);
    if (res.ok) return decideNpm((await res.json()) as RegistryDocument, target);
    return {source: 'npm', name: target.name, status: 'unknown', detail: `http ${res.status}`};
  } catch (err) {
    return {source: 'npm', name: target.name, status: 'unknown', detail: (err as Error).message};
  }
}

async function checkGitHub(repo: string): Promise<CheckResult> {
  try {
    await execFileP('gh', ['repo', 'view', repo], {encoding: 'utf8'});
    return {source: 'github', name: repo, status: 'taken', detail: 'gh repo view succeeded'};
  } catch (err) {
    const message = (err as {stderr?: string; message?: string}).stderr ?? (err as Error).message;
    if (/Could not resolve to a Repository/i.test(message) || /not found/i.test(message)) {
      return {source: 'github', name: repo, status: 'available', detail: 'gh reports not found'};
    }
    return {source: 'github', name: repo, status: 'unknown', detail: message};
  }
}

function loadPkg(): {name: string; version: string} {
  return require(path.join(__dirname, '..', 'package.json')) as {name: string; version: string};
}

function color(status: CheckResult['status']): (s: string) => string {
  if (status === 'available') return pc.green;
  if (status === 'taken') return pc.red;
  return pc.yellow;
}

async function main(): Promise<void> {
  const pkg = loadPkg();
  const repo = process.env.AIRGAP_BOT_REPO ?? 'xmpuspus/create-airgap-bot';
  const owner = process.env.AIRGAP_BOT_NPM_OWNER ?? 'xmpuspus';
  const target = {name: pkg.name, version: pkg.version, owner};

  process.stdout.write(pc.bold('create-airgap-bot conflict check\n'));
  process.stdout.write(pc.dim(`npm name:    ${pkg.name}@${pkg.version} (owner ${owner})\n`));
  process.stdout.write(pc.dim(`gh repo:     ${repo}\n\n`));

  const [npmResult, ghResult] = await Promise.all([checkNpm(target), checkGitHub(repo)]);

  for (const r of [npmResult, ghResult]) {
    const c = color(r.status);
    process.stdout.write(
      `${pc.bold(r.source.padEnd(7))} ${c(r.status.padEnd(10))} ${r.name}  ${pc.dim(r.detail)}\n`,
    );
  }

  // The npm name blocks when another account owns it or the version exists.
  // "unknown" warns but does not block. The umbrella repo xmpuspus/airgap is
  // fine; a standalone xmpuspus/create-airgap-bot repo must not exist.
  if (npmResult.status === 'taken' || ghResult.status === 'taken') {
    process.stdout.write('\n' + pc.red('Conflict detected. Resolve before publishing.\n'));
    process.exit(1);
  }
  process.stdout.write('\n' + pc.green('All clear. Safe to publish.\n'));
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(pc.red(`conflict-check failed: ${(err as Error).message}\n`));
    process.exit(2);
  });
}
