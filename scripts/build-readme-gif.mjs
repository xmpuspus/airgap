#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import recordings from './lib/recordings.js';
import {
  createContactSheet,
  currentCommit,
  evidenceDirectory,
  probeMedia,
  relativeToRoot,
  run,
  upsertRecording,
} from './recording-utils.mjs';

const {README_GIF_OPTIONS, gifPaletteFilter, readmeLayoutFilter} = recordings;

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
  const evidence = evidenceDirectory(root, sourceCommit);
  const android = path.join(evidence, 'android.mp4');
  const ios = path.join(evidence, 'ios.mp4');
  if (!fs.existsSync(android) || !fs.existsSync(ios))
    throw new Error('recording_platform_source_missing');
  const source = path.join(evidence, 'readme-side-by-side.mp4');
  const output = path.join(root, 'demo', 'airgap-readme-side-by-side.gif');
  const contactSheet = path.join(evidence, 'readme-side-by-side-contact.png');
  const duration = Math.min(probeMedia(android).durationSeconds, probeMedia(ios).durationSeconds);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'recordings.json'), 'utf8'));
  const platformRecords = ['android', 'ios'].map(id =>
    manifest.recordings.find(recording => recording.id === id),
  );
  if (platformRecords.some(recording => !recording)) {
    throw new Error('recording_platform_metadata_missing');
  }
  const evidenceClass = [
    ...new Set(platformRecords.flatMap(recording => recording.evidenceClass)),
  ].sort();
  const providerIds = [...new Set(platformRecords.map(recording => recording.providerId))];
  const modelIdentities = [...new Set(platformRecords.map(recording => recording.modelIdentity))];
  const layout = readmeLayoutFilter(README_GIF_OPTIONS);
  run('ffmpeg', [
    '-y',
    '-i',
    android,
    '-i',
    ios,
    '-t',
    String(duration),
    '-filter_complex',
    layout,
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    source,
  ]);
  const palette = gifPaletteFilter(README_GIF_OPTIONS);
  run('ffmpeg', ['-y', '-i', source, '-filter_complex', palette, '-loop', '0', output]);
  createContactSheet({source, output: contactSheet});
  const probe = probeMedia(output);
  upsertRecording(root, {
    id: 'readme-side-by-side',
    kind: 'readme',
    output: relativeToRoot(root, output),
    source: relativeToRoot(root, source),
    contactSheet: relativeToRoot(root, contactSheet),
    script: 'scripts/build-readme-gif.mjs',
    sourceCommit,
    platform: 'joint',
    os: 'Android and iOS',
    device: 'Android Emulator and iPhone 17 Pro Simulator',
    mode: 'demo',
    providerId: providerIds.join(' + '),
    modelIdentity: modelIdentities.join(' + '),
    evidenceClass,
    captureCommand: `node scripts/build-readme-gif.mjs --commit ${sourceCommit}`,
    config: 'airgap.config.json',
    capturedAt: new Date().toISOString(),
    ...probe,
    bytes: fs.statSync(output).size,
    playbackSpeed: 1,
    omittedSourceRangesSeconds: [],
    loopReviewed: false,
  });
  process.stdout.write(`Built ${relativeToRoot(root, output)}.\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
