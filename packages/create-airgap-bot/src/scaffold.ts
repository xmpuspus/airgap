import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
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
}

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

async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, {recursive: true});
  const entries = await fsp.readdir(src, {withFileTypes: true});
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === 'coverage' ||
      entry.name === '.gradle' ||
      entry.name === '.cxx' ||
      entry.name === '.kotlin' ||
      entry.name === 'Pods' ||
      entry.name === '.claude' ||
      entry.name === '.worktrees' ||
      entry.name === 'tmp' ||
      entry.name === '.DS_Store'
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

function toCamelCase(value: string): string {
  return value.replace(/[-_](.)/g, (_, character: string) => character.toUpperCase());
}

async function writeKnowledgeManifest(knowledgeDir: string): Promise<void> {
  const files = (await fsp.readdir(knowledgeDir)).filter(name => name.endsWith('.json')).sort();
  const names = files.map(name => toCamelCase(path.basename(name, '.json')));
  const imports = files.map((name, index) => `import ${names[index]} from './${name}';`).join('\n');
  const exports = names.map(name => `  ${name},`).join('\n');
  const content = `/**
 * Knowledge Base Manifest (auto-generated)
 * Run: node scripts/generate-manifest.js
 */
${imports}

export const knowledgeFiles = {
${exports}
};
`;
  await fsp.writeFile(path.join(knowledgeDir, 'manifest.ts'), content);
}

async function applyTemplate(targetDir: string, template: Template): Promise<void> {
  // Replace the default airgap.config.json with the chosen template's config.
  const cfgSrc = path.join(targetDir, 'examples', template, 'airgap.config.json');
  const cfgDest = path.join(targetDir, 'airgap.config.json');
  if (!fs.existsSync(cfgSrc)) {
    throw new Error(`Template config missing: ${cfgSrc}`);
  }
  await fsp.copyFile(cfgSrc, cfgDest);

  // Replace compiled knowledge data while preserving its TypeScript module.
  const knSrc = path.join(targetDir, 'examples', template, 'knowledge');
  const knDest = path.join(targetDir, 'src', 'knowledge');
  if (!fs.existsSync(knSrc)) {
    throw new Error(`Template knowledge dir missing: ${knSrc}`);
  }
  for (const name of await fsp.readdir(knDest)) {
    if (name.endsWith('.json')) await fsp.rm(path.join(knDest, name));
  }
  await copyDir(knSrc, knDest);
  await writeKnowledgeManifest(knDest);
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const {botName, template, targetDir} = opts;

  await ensureEmptyTarget(targetDir);

  let sourceRoot = path.resolve(__dirname, '..', 'template');
  if (opts.sourceDir) {
    process.stdout.write(pc.dim(`Using local source: ${opts.sourceDir}\n`));
    sourceRoot = opts.sourceDir;
  } else {
    process.stdout.write(pc.dim('Using the packaged Airgap template\n'));
    if (!fs.existsSync(sourceRoot)) {
      throw new Error('Packaged template is missing. Run npm run build-template.');
    }
  }

  process.stdout.write(pc.dim(`Copying files into: ${targetDir}\n`));
  await copyDir(sourceRoot, targetDir);

  process.stdout.write(pc.dim(`Applying template: ${template}\n`));
  await applyTemplate(targetDir, template);

  process.stdout.write(pc.dim(`Renaming app to: ${botName}\n`));
  await rename({targetDir, botName});
}
