import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() : '';
    throw new Error(
      `recording_command_failed:${command}:${result.status}${detail ? `:${detail}` : ''}`,
    );
  }
  return options.capture ? result.stdout.trim() : '';
}

export function currentCommit(root) {
  return run('git', ['rev-parse', 'HEAD'], {cwd: root, capture: true});
}

export function assertCommit(root, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('recording_commit_invalid');
  run('git', ['cat-file', '-e', `${commit}^{commit}`], {cwd: root, capture: true});
}

export function evidenceDirectory(root, commit) {
  const directory = path.join(root, 'tmp', 'recordings', commit);
  fs.mkdirSync(directory, {recursive: true});
  return directory;
}

export function findMaestro() {
  const candidates = [
    process.env.MAESTRO_BIN,
    '/Users/xavier/.maestro/bin/maestro',
    '/opt/homebrew/bin/maestro',
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) throw new Error('recording_maestro_missing');
  return executable;
}

export function maestroEnvironment(extra = {}) {
  const javaHome =
    process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
  if (!fs.existsSync(path.join(javaHome, 'bin', 'java'))) throw new Error('recording_java_missing');
  return {...process.env, JAVA_HOME: javaHome, ...extra};
}

export function runMaestro({root, flow, device, values, outputDirectory}) {
  fs.mkdirSync(outputDirectory, {recursive: true});
  const args = [
    'test',
    '--no-ansi',
    '--device',
    device,
    '--test-output-dir',
    outputDirectory,
    '--debug-output',
    outputDirectory,
  ];
  for (const [key, value] of Object.entries(values)) args.push('-e', `${key}=${value}`);
  args.push(flow);
  run(findMaestro(), args, {cwd: root, env: maestroEnvironment()});
}

export function convertToGif({source, output, fps = 10, width = 360, colors = 96}) {
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const filter = [
    `fps=${fps}`,
    `scale=${width}:-2:flags=lanczos`,
    'split[s0][s1]',
    `[s0]palettegen=max_colors=${colors}:stats_mode=diff[p]`,
    '[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  ].join(';');
  run('ffmpeg', ['-y', '-i', source, '-filter_complex', filter, '-loop', '0', output]);
}

export function createContactSheet({source, output}) {
  fs.mkdirSync(path.dirname(output), {recursive: true});
  run('ffmpeg', [
    '-y',
    '-i',
    source,
    '-vf',
    'fps=1/4,scale=220:-2:flags=lanczos,tile=4x3:padding=8:margin=8:color=white',
    '-frames:v',
    '1',
    output,
  ]);
}

function parseRate(value) {
  const [numerator, denominator = '1'] = String(value).split('/').map(Number);
  return denominator ? numerator / denominator : 0;
}

export function probeMedia(file) {
  const raw = run(
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
      file,
    ],
    {capture: true},
  );
  const data = JSON.parse(raw);
  const stream = data.streams?.[0] ?? {};
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    fps: Number(parseRate(stream.r_frame_rate).toFixed(3)),
    durationSeconds: Number(Number(data.format?.duration).toFixed(3)),
  };
}

export function relativeToRoot(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

export function upsertRecording(root, recording) {
  const manifestPath = path.join(root, 'demo', 'recordings.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {schemaVersion: 1, recordings: []};
  manifest.recordings = manifest.recordings.filter(item => item.output !== recording.output);
  manifest.recordings.push(recording);
  manifest.recordings.sort((left, right) => left.output.localeCompare(right.output));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
