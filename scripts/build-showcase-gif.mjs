#!/usr/bin/env node
// Build the comparison GIF: one quote card per published reply on the left,
// one recorded take per model on the right, beat by beat. The takes come from
// demo/recordings.json, and their beat boundaries come from the Maestro
// command log of each take. Nothing on the left is a recording of the other
// app: each card quotes a published reply and says where it came from.
//
//   node scripts/build-showcase-gif.mjs --spec demo/showcase/government.json

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import recordings from './lib/recordings.js';
import {
  convertToGif,
  probeMedia,
  relativeToRoot,
  run,
  upsertRecording,
} from './recording-utils.mjs';

const {validateRecording} = recordings;

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 640;
const CARD_WIDTH = 330;
const FPS = 10;
const BACKGROUND = '0x071727';
const FONT = '/System/Library/Fonts/Helvetica.ttc';
const MIN_BEAT_SECONDS = 6;
const TITLE_SECONDS = 3;

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function wrap(text, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if ((line + ' ' + word).trim().length > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function latestCommandLog(root, recording) {
  const directory = path.join(
    root,
    'tmp',
    'recordings',
    recording.sourceCommit,
    `${recording.id}-maestro`,
  );
  const runs = fs.readdirSync(directory).sort();
  const latest = runs.at(-1);
  const file = fs
    .readdirSync(path.join(directory, latest))
    .find(name => name.startsWith('commands-'));
  return JSON.parse(fs.readFileSync(path.join(directory, latest, file), 'utf8'));
}

// A beat runs from the end of the previous screenshot to the end of its own.
function beatRanges(commands) {
  const sorted = [...commands].sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  const start = sorted.find(c => c.command.startRecordingCommand).metadata.timestamp;
  const shots = sorted.filter(
    c => c.command.takeScreenshotCommand && c.metadata.timestamp >= start,
  );
  const ranges = [];
  for (let index = 1; index < shots.length; index += 1) {
    const previous = shots[index - 1].metadata;
    const current = shots[index].metadata;
    ranges.push([
      (previous.timestamp + previous.duration - start) / 1000,
      (current.timestamp + current.duration - start) / 1000,
    ]);
  }
  return ranges;
}

// Cut the omitted ranges out of one beat and return the kept pieces.
function keptPieces([from, to], omitted) {
  const pieces = [];
  let cursor = from;
  for (const [omitFrom, omitTo] of omitted) {
    if (omitTo <= cursor || omitFrom >= to) continue;
    if (omitFrom > cursor) pieces.push([cursor, Math.min(omitFrom, to)]);
    cursor = Math.max(cursor, omitTo);
  }
  if (cursor < to) pieces.push([cursor, to]);
  return pieces.filter(([a, b]) => b - a > 0.05);
}

function renderPanelBeat({source, pieces, speed, output}) {
  const trims = pieces.map(
    ([a, b], index) => `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[p${index}]`,
  );
  const labels = pieces.map((_, index) => `[p${index}]`).join('');
  const filter = [
    ...trims,
    `${labels}concat=n=${pieces.length}:v=1:a=0,setpts=PTS/${speed},fps=${FPS},` +
      `scale=${PANEL_WIDTH}:-2:flags=lanczos,pad=${PANEL_WIDTH}:${PANEL_HEIGHT}:0:(oh-ih)/2:color=${BACKGROUND}[v]`,
  ].join(';');
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    source,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output,
  ]);
}

function padTo(input, seconds, output) {
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    input,
    '-vf',
    `tpad=stop_mode=clone:stop_duration=${seconds},trim=end=${seconds},setpts=PTS-STARTPTS`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output,
  ]);
}

function drawText({file, size, color, y}) {
  return `drawtext=fontfile=${FONT}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=18:y=${y}:line_spacing=5`;
}

function renderCard({workDir, index, heading, beat, footer, seconds, output}) {
  const files = {
    heading: path.join(workDir, `card-${index}-heading.txt`),
    prompt: path.join(workDir, `card-${index}-prompt.txt`),
    theirs: path.join(workDir, `card-${index}-theirs.txt`),
    evidence: path.join(workDir, `card-${index}-evidence.txt`),
    footer: path.join(workDir, `card-${index}-footer.txt`),
  };
  fs.writeFileSync(files.heading, heading);
  fs.writeFileSync(files.prompt, wrap(`"${beat.prompt}"`, 34));
  fs.writeFileSync(files.theirs, wrap(beat.theirs, 38));
  fs.writeFileSync(files.evidence, wrap(beat.evidence || ' ', 44));
  fs.writeFileSync(files.footer, wrap(footer, 46));
  const promptLines = fs.readFileSync(files.prompt, 'utf8').split('\n').length;
  const theirsLines = fs.readFileSync(files.theirs, 'utf8').split('\n').length;
  const promptY = 60;
  const theirsY = promptY + promptLines * 23 + 18;
  const evidenceY = theirsY + theirsLines * 21 + 16;
  const filter = [
    drawText({file: files.heading, size: 14, color: '0x9FB3C8', y: 24}),
    drawText({file: files.prompt, size: 18, color: 'white', y: promptY}),
    drawText({file: files.theirs, size: 16, color: '0xFFD28A', y: theirsY}),
    drawText({file: files.evidence, size: 12, color: '0x9FB3C8', y: evidenceY}),
    drawText({file: files.footer, size: 11, color: '0x6B7F94', y: PANEL_HEIGHT - 70}),
  ].join(',');
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${BACKGROUND}:s=${CARD_WIDTH}x${PANEL_HEIGHT}:r=${FPS}`,
    '-t',
    String(seconds),
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output,
  ]);
}

function renderTitle({workDir, title, panels, output}) {
  const file = path.join(workDir, 'title.txt');
  const width = CARD_WIDTH + panels.length * PANEL_WIDTH;
  fs.writeFileSync(file, wrap(title, 60) + '\n\n' + panels.map(p => wrap(p.label, 70)).join('\n'));
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${BACKGROUND}:s=${width}x${PANEL_HEIGHT}:r=${FPS}`,
    '-t',
    String(TITLE_SECONDS),
    '-vf',
    drawText({file, size: 20, color: 'white', y: 220}),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output,
  ]);
}

function stack(inputs, output) {
  const layout = inputs
    .map((_, index) => `${index === 0 ? 0 : CARD_WIDTH + (index - 1) * PANEL_WIDTH}_0`)
    .join('|');
  const labels = inputs.map((_, index) => `[${index}:v]`).join('');
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...inputs.flatMap(input => ['-i', input]),
    '-filter_complex',
    `${labels}xstack=inputs=${inputs.length}:layout=${layout}:fill=${BACKGROUND}[v]`,
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output,
  ]);
}

function concat(parts, output) {
  const list = `${output}.txt`;
  fs.writeFileSync(list, parts.map(part => `file '${part}'`).join('\n') + '\n');
  run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c',
    'copy',
    output,
  ]);
}

function main() {
  const root = rootFromScript();
  const spec = JSON.parse(fs.readFileSync(path.resolve(root, valueAfter('--spec')), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'recordings.json'), 'utf8'));
  const takes = spec.panels.map(panel => {
    const recording = manifest.recordings.find(item => item.id === panel.recording);
    if (!recording) throw new Error(`showcase_recording_missing:${panel.recording}`);
    validateRecording(recording);
    const beats = beatRanges(latestCommandLog(root, recording));
    if (beats.length !== spec.beats.length) {
      throw new Error(
        `showcase_beat_count:${panel.recording}:${beats.length}:${spec.beats.length}`,
      );
    }
    return {panel, recording, beats};
  });
  const commits = [...new Set(takes.map(take => take.recording.sourceCommit))];
  if (commits.length !== 1) throw new Error(`showcase_commit_mismatch:${commits.join(',')}`);
  const sourceCommit = commits[0];
  const workDir = path.join(root, 'tmp', 'recordings', sourceCommit, `${spec.id}-work`);
  fs.rmSync(workDir, {recursive: true, force: true});
  fs.mkdirSync(workDir, {recursive: true});

  const footer = spec.panels.map(panel => panel.label).join('\n');
  const beatVideos = [];
  spec.beats.forEach((beat, index) => {
    const panelVideos = takes.map((take, panelIndex) => {
      const output = path.join(workDir, `beat-${index}-panel-${panelIndex}.mp4`);
      renderPanelBeat({
        source: path.join(root, take.recording.source),
        pieces: keptPieces(take.beats[index], take.recording.omittedSourceRangesSeconds ?? []),
        speed: take.recording.playbackSpeed ?? 1,
        output,
      });
      return output;
    });
    const seconds = Math.max(
      MIN_BEAT_SECONDS,
      ...panelVideos.map(video => probeMedia(video).durationSeconds),
    );
    const padded = panelVideos.map((video, panelIndex) => {
      const output = path.join(workDir, `beat-${index}-panel-${panelIndex}-padded.mp4`);
      padTo(video, seconds, output);
      return output;
    });
    const card = path.join(workDir, `beat-${index}-card.mp4`);
    renderCard({workDir, index, heading: spec.leftHeading, beat, footer, seconds, output: card});
    const composed = path.join(workDir, `beat-${index}.mp4`);
    stack([card, ...padded], composed);
    beatVideos.push(composed);
  });

  const title = path.join(workDir, 'title.mp4');
  renderTitle({workDir, title: spec.title, panels: spec.panels, output: title});
  const source = path.join(root, 'tmp', 'recordings', sourceCommit, `${spec.id}.mp4`);
  concat([title, ...beatVideos], source);

  const output = path.join(root, spec.output);
  const width = CARD_WIDTH + spec.panels.length * PANEL_WIDTH;
  convertToGif({source, output, fps: FPS, width, colors: 96, playbackSpeed: 1});
  const probe = probeMedia(output);
  const classes = [...new Set(takes.map(take => take.recording.evidenceClass))].sort();
  upsertRecording(root, {
    id: spec.id,
    kind: 'showcase',
    output: relativeToRoot(root, output),
    source: relativeToRoot(root, source),
    contactSheet: takes[0].recording.contactSheet,
    script: 'scripts/build-showcase-gif.mjs',
    sourceCommit,
    platform: 'joint',
    os: takes.map(take => take.recording.os).join(' and '),
    device: takes.map(take => take.recording.device).join(' and '),
    mode: takes[0].recording.mode,
    providerId: takes.map(take => take.recording.providerId).join(' + '),
    modelIdentity: takes.map(take => take.recording.modelIdentity).join(' + '),
    evidenceClass: classes.length === 1 ? classes[0] : classes,
    providerEvidenceClass: 'virtual-device-model',
    captureCommand: `node scripts/build-showcase-gif.mjs --spec ${relativeToRoot(
      root,
      path.resolve(root, valueAfter('--spec')),
    )}`,
    config: takes[0].recording.config,
    capturedAt: new Date().toISOString(),
    ...probe,
    bytes: fs.statSync(output).size,
    playbackSpeed: 1,
    omittedSourceRangesSeconds: [],
    loopReviewed: false,
  });
  process.stdout.write(`Built ${relativeToRoot(root, output)} from ${takes.length} takes.\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
