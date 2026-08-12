#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {validateManifest, validateRecording} = require('./lib/recordings.js');

function repositoryRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function parseRate(value) {
  const [numerator, denominator = '1'] = String(value).split('/').map(Number);
  return denominator ? numerator / denominator : 0;
}

function probeGif(root, output) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate:format=duration',
      '-of',
      'json',
      path.join(root, output),
    ],
    {encoding: 'utf8'},
  );
  if (result.status !== 0)
    throw new Error(`recording_probe_failed:${output}:${result.stderr.trim()}`);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.[0] ?? {};
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    fps: parseRate(stream.r_frame_rate),
    durationSeconds: Number(data.format?.duration),
  };
}

function checkCommit(root, sourceCommit) {
  const result = spawnSync('git', ['cat-file', '-e', `${sourceCommit}^{commit}`], {cwd: root});
  if (result.status !== 0) throw new Error(`recording_commit_unavailable:${sourceCommit}`);
}

function main() {
  const root = repositoryRoot();
  const manifestPath = path.join(root, 'demo', 'recordings.json');
  if (!fs.existsSync(manifestPath)) throw new Error('recording_manifest_missing');
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  const commits = new Set();

  for (const recording of manifest.recordings) {
    const output = path.join(root, recording.output);
    if (!fs.existsSync(output)) throw new Error(`recording_file_missing:${recording.output}`);
    const descriptor = fs.openSync(output, 'r');
    const header = Buffer.alloc(6);
    fs.readSync(descriptor, header, 0, header.length, 0);
    fs.closeSync(descriptor);
    const stats = fs.statSync(output);
    validateRecording(recording, {
      actualBytes: stats.size,
      header,
      probe: probeGif(root, recording.output),
    });
    commits.add(recording.sourceCommit);
  }

  for (const commit of commits) checkCommit(root, commit);
  process.stdout.write(`Validated ${manifest.recordings.length} release recordings.\n`);
}

export {parseRate, probeGif, validateManifest, validateRecording};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
