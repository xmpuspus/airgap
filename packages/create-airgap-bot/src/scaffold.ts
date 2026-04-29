import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import * as tar from 'tar';
import pc from 'picocolors';
import {rename} from './rename';
import type {Template} from './templates';

export interface ScaffoldOptions {
  botName: string;
  template: Template;
  targetDir: string;
  // Optional override; when set, the scaffolder copies from this directory
  // instead of fetching a tarball. Used by tests and offline runs.
  sourceDir?: string;
  // Tarball URL override. Defaults to the main branch of xmpuspus/airgap.
  tarballUrl?: string;
}

const DEFAULT_TARBALL_URL =
  'https://codeload.github.com/xmpuspus/airgap/tar.gz/refs/heads/main';

async function ensureEmptyTarget(targetDir: string): Promise<void> {
  if (fs.existsSync(targetDir)) {
    const entries = await fsp.readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Target directory is not empty: ${targetDir}. Choose a different bot name or remove the directory.`,
      );
    }
  } else {
    await fsp.mkdir(targetDir, {recursive: true});
  }
}

async function downloadTarball(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download tarball: ${response.status} ${response.statusText} (${url})`);
  }
  const out = fs.createWriteStream(dest);
  // node 22 supports converting a fetch ReadableStream to a node stream.
  const nodeStream = require('node:stream').Readable.fromWeb(response.body as any);
  await pipeline(nodeStream, out);
}

async function extractTarball(tarballPath: string, dest: string): Promise<string> {
  await fsp.mkdir(dest, {recursive: true});
  await tar.x({
    file: tarballPath,
    cwd: dest,
  });
  // GitHub codeload archives are a single top-level dir like "airgap-main".
  const entries = await fsp.readdir(dest);
  const dirs = await Promise.all(
    entries.map(async (e) => {
      const p = path.join(dest, e);
      const stat = await fsp.stat(p);
      return stat.isDirectory() ? p : null;
    }),
  );
  const top = dirs.find((d): d is string => d !== null);
  if (!top) {
    throw new Error(`Tarball did not contain a top-level directory: ${tarballPath}`);
  }
  return top;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, {recursive: true});
  const entries = await fsp.readdir(src, {withFileTypes: true});
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.gradle' ||
      entry.name === 'Pods' ||
      entry.name === '.claude'
    ) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = await fsp.readlink(srcPath);
      await fsp.symlink(link, destPath);
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function applyTemplate(targetDir: string, template: Template): Promise<void> {
  // Replace the default airgap.config.json with the chosen template's config.
  const cfgSrc = path.join(targetDir, 'examples', template, 'airgap.config.json');
  const cfgDest = path.join(targetDir, 'airgap.config.json');
  if (!fs.existsSync(cfgSrc)) {
    throw new Error(`Template config missing: ${cfgSrc}`);
  }
  await fsp.copyFile(cfgSrc, cfgDest);

  // Replace src/knowledge/ with the template's knowledge/.
  const knSrc = path.join(targetDir, 'examples', template, 'knowledge');
  const knDest = path.join(targetDir, 'src', 'knowledge');
  if (!fs.existsSync(knSrc)) {
    throw new Error(`Template knowledge dir missing: ${knSrc}`);
  }
  await fsp.rm(knDest, {recursive: true, force: true});
  await copyDir(knSrc, knDest);
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const {botName, template, targetDir} = opts;
  const tarballUrl = opts.tarballUrl ?? DEFAULT_TARBALL_URL;

  await ensureEmptyTarget(targetDir);

  let sourceRoot: string;
  let tmpRoot: string | null = null;

  if (opts.sourceDir) {
    process.stdout.write(pc.dim(`Using local source: ${opts.sourceDir}\n`));
    sourceRoot = opts.sourceDir;
  } else {
    process.stdout.write(pc.dim(`Downloading template: ${tarballUrl}\n`));
    tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'create-airgap-bot-'));
    const tarPath = path.join(tmpRoot, 'airgap.tar.gz');
    await downloadTarball(tarballUrl, tarPath);
    sourceRoot = await extractTarball(tarPath, path.join(tmpRoot, 'extract'));
  }

  process.stdout.write(pc.dim(`Copying files into: ${targetDir}\n`));
  await copyDir(sourceRoot, targetDir);

  process.stdout.write(pc.dim(`Applying template: ${template}\n`));
  await applyTemplate(targetDir, template);

  process.stdout.write(pc.dim(`Renaming app to: ${botName}\n`));
  await rename({targetDir, botName});

  if (tmpRoot) {
    await fsp.rm(tmpRoot, {recursive: true, force: true});
  }
}
