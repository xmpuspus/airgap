#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertToGif, currentCommit, probeMedia, run} from './recording-utils.mjs';

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const root = rootFromScript();
  const sourceCommit = valueAfter('--commit') ?? currentCommit(root);
  const manifestPath = path.join(root, 'demo', 'recordings.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const recording of manifest.recordings) {
    if (recording.sourceCommit !== sourceCommit) continue;
    if (recording.kind === 'readme') continue;
    const playbackSpeed = recording.kind === 'industry' || recording.platform === 'android' ? 4 : 1;
    const output = path.join(root, recording.output);
    const source = path.join(root, recording.source);
    if (!fs.existsSync(source)) {
      throw new Error(`recording_source_missing:${recording.source}`);
    }
    convertToGif({
      source,
      output,
      fps: 10,
      width: 360,
      colors: recording.kind === 'industry' ? 80 : 96,
      playbackSpeed,
      omittedSourceRangesSeconds: recording.omittedSourceRangesSeconds ?? [],
    });

    const probe = probeMedia(output);
    Object.assign(recording, probe, {
      bytes: fs.statSync(output).size,
      playbackSpeed,
      omittedSourceRangesSeconds: recording.omittedSourceRangesSeconds ?? [],
      loopReviewed: false,
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run(
    process.execPath,
    [path.join(root, 'scripts', 'build-readme-gif.mjs'), '--commit', sourceCommit],
    {cwd: root},
  );
  process.stdout.write(`Rebuilt public GIFs for ${sourceCommit}.\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
