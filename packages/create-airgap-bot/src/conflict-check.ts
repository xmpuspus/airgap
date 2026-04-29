#!/usr/bin/env node
// Pre-publish conflict checker. Verifies the package name is available on npm
// and that the GitHub repo namespace is free. Exits non-zero if either is
// taken so the publish workflow can abort before pushing a tag.
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

async function checkNpm(name: string): Promise<CheckResult> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (res.status === 404) {
      return {source: 'npm', name, status: 'available', detail: '404 from registry'};
    }
    if (res.ok) {
      const body = (await res.json()) as {name?: string; 'dist-tags'?: {latest?: string}};
      const latest = body['dist-tags']?.latest ?? 'unknown';
      return {
        source: 'npm',
        name,
        status: 'taken',
        detail: `latest=${latest}`,
      };
    }
    return {source: 'npm', name, status: 'unknown', detail: `http ${res.status}`};
  } catch (err) {
    return {source: 'npm', name, status: 'unknown', detail: (err as Error).message};
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

function loadPkg(): {name: string} {
  const pkg = require(path.join(__dirname, '..', 'package.json')) as {name: string};
  return pkg;
}

function color(status: CheckResult['status']): (s: string) => string {
  if (status === 'available') return pc.green;
  if (status === 'taken') return pc.red;
  return pc.yellow;
}

async function main(): Promise<void> {
  const pkg = loadPkg();
  const repo = process.env.AIRGAP_BOT_REPO ?? 'xmpuspus/create-airgap-bot';

  process.stdout.write(pc.bold('create-airgap-bot conflict check\n'));
  process.stdout.write(pc.dim(`npm name:    ${pkg.name}\n`));
  process.stdout.write(pc.dim(`gh repo:     ${repo}\n\n`));

  const [npmResult, ghResult] = await Promise.all([checkNpm(pkg.name), checkGitHub(repo)]);

  for (const r of [npmResult, ghResult]) {
    const c = color(r.status);
    process.stdout.write(
      `${pc.bold(r.source.padEnd(7))} ${c(r.status.padEnd(10))} ${r.name}  ${pc.dim(r.detail)}\n`,
    );
  }

  // npm "taken" is fatal for a fresh publish; "unknown" warns but does not block.
  // Repo "taken" is acceptable when the repo is the umbrella (xmpuspus/airgap monorepo)
  // but the dedicated repo `xmpuspus/create-airgap-bot` should not exist as standalone.
  const npmBlock = npmResult.status === 'taken';
  const ghBlock = ghResult.status === 'taken';

  if (npmBlock || ghBlock) {
    process.stdout.write(
      '\n' + pc.red('Conflict detected. Resolve before publishing.\n'),
    );
    process.exit(1);
  }
  process.stdout.write('\n' + pc.green('All clear. Safe to publish.\n'));
}

main().catch((err) => {
  process.stderr.write(pc.red(`conflict-check failed: ${(err as Error).message}\n`));
  process.exit(2);
});
