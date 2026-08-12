#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createContactSheet,
  currentCommit,
  evidenceDirectory,
  probeMedia,
  relativeToRoot,
  run,
  upsertRecording,
} from './recording-utils.mjs';

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
  const layout = [
    '[0:v]scale=360:-2:flags=lanczos,pad=360:800:0:(oh-ih)/2:color=0x071727[a]',
    '[1:v]scale=360:-2:flags=lanczos,pad=360:800:0:(oh-ih)/2:color=0x071727[b]',
    '[a][b]xstack=inputs=2:layout=0_0|372_0:fill=0x071727[v]',
  ].join(';');
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
  const palette = [
    'fps=10',
    'split[s0][s1]',
    '[s0]palettegen=max_colors=80:stats_mode=diff[p]',
    '[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  ].join(';');
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
    config: 'airgap.config.json',
    capturedAt: new Date().toISOString(),
    ...probe,
    bytes: fs.statSync(output).size,
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
