const path = require('node:path');
const {Buffer} = require('node:buffer');
const fs = require('node:fs');

const MIB = 1024 * 1024;

const README_GIF_OPTIONS = Object.freeze({
  panelWidth: 280,
  panelHeight: 622,
  gap: 12,
  fps: 10,
  colors: 40,
  ditherScale: 5,
});

const REQUIRED_OUTPUTS = Object.freeze([
  'demo/airgap-demo.gif',
  'demo/airgap-demo-ios.gif',
  'demo/airgap-readme-side-by-side.gif',
  'demo/industry-airline.gif',
  'demo/industry-banking.gif',
  'demo/industry-electric.gif',
  'demo/industry-healthcare.gif',
  'demo/industry-insurance.gif',
  'demo/industry-telco.gif',
  'demo/industry-water.gif',
]);

const SIZE_LIMITS = Object.freeze({
  readme: 5 * MIB,
  platform: 8 * MIB,
  industry: 3 * MIB,
  joint: 8 * MIB,
});

const EVIDENCE_CLASSES = Object.freeze(['emulator', 'physical-device', 'simulator']);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function sizeLimitFor(kind) {
  const limit = SIZE_LIMITS[kind];
  if (!limit) fail('recording_kind_invalid', String(kind));
  return limit;
}

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function normalized(value) {
  return typeof value === 'string' ? value.split(path.sep).join('/') : '';
}

function nonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function validateEvidenceClass(recording) {
  const classes = Array.isArray(recording.evidenceClass)
    ? recording.evidenceClass
    : [recording.evidenceClass];
  if (
    classes.length === 0 ||
    classes.some(value => !EVIDENCE_CLASSES.includes(value)) ||
    new Set(classes).size !== classes.length ||
    classes.join(',') !== [...classes].sort().join(',')
  ) {
    fail('recording_evidence_class_invalid');
  }
  if (recording.platform === 'joint') {
    if (!Array.isArray(recording.evidenceClass) || classes.length < 2) {
      fail('recording_evidence_class_invalid');
    }
  } else if (Array.isArray(recording.evidenceClass) || classes.length !== 1) {
    fail('recording_evidence_class_invalid');
  }

  const device = String(recording.device ?? '').toLowerCase();
  if (
    classes.includes('physical-device') &&
    /(emulator|simulator|sdk_gphone|generic_x86|virtual device)/.test(device)
  ) {
    fail('recording_evidence_class_invalid');
  }
  if (classes.includes('emulator') && recording.platform === 'ios') {
    fail('recording_evidence_class_invalid');
  }
  if (classes.includes('simulator') && recording.platform === 'android') {
    fail('recording_evidence_class_invalid');
  }
}

function maestroRecordingPath(target) {
  return path.resolve(target).split(path.sep).join('/');
}

function gifFilter({fps, width, colors, playbackSpeed = 1, omittedSourceRangesSeconds = []}) {
  const filters = [];
  let input = '';
  if (omittedSourceRangesSeconds.length > 0) {
    const segments = [];
    let start = 0;
    for (const [rangeStart, rangeEnd] of omittedSourceRangesSeconds) {
      const label = `segment${segments.length}`;
      const trim = start === 0 ? `end=${rangeStart}` : `start=${start}:end=${rangeStart}`;
      filters.push(`[0:v]trim=${trim},setpts=PTS-STARTPTS[${label}]`);
      segments.push(`[${label}]`);
      start = rangeEnd;
    }
    const label = `segment${segments.length}`;
    filters.push(`[0:v]trim=start=${start},setpts=PTS-STARTPTS[${label}]`);
    segments.push(`[${label}]`);
    input = `${segments.join('')}concat=n=${segments.length}:v=1:a=0,`;
  }
  return [
    ...filters,
    `${input}setpts=PTS/${playbackSpeed},fps=${fps},scale=${width}:-2:flags=lanczos,split[s0][s1]`,
    `[s0]palettegen=max_colors=${colors}:stats_mode=diff[p]`,
    '[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  ].join(';');
}

function gifPaletteFilter({fps, colors, ditherScale = 4}) {
  return [
    `fps=${fps},split[s0][s1]`,
    `[s0]palettegen=max_colors=${colors}:stats_mode=diff[p]`,
    `[s1][p]paletteuse=dither=bayer:bayer_scale=${ditherScale}:diff_mode=rectangle`,
  ].join(';');
}

function readmeLayoutFilter({panelWidth, panelHeight, gap}) {
  const secondPanelX = panelWidth + gap;
  return [
    `[0:v]scale=${panelWidth}:-2:flags=lanczos,pad=${panelWidth}:${panelHeight}:0:(oh-ih)/2:color=0x071727[a]`,
    `[1:v]scale=${panelWidth}:-2:flags=lanczos,pad=${panelWidth}:${panelHeight}:0:(oh-ih)/2:color=0x071727[b]`,
    `[a][b]xstack=inputs=2:layout=0_0|${secondPanelX}_0:fill=0x071727[v]`,
  ].join(';');
}

function replaceKnowledgeData(source, target) {
  for (const name of fs.readdirSync(target)) {
    if (name.endsWith('.json')) fs.rmSync(path.join(target, name));
  }
  for (const name of fs.readdirSync(source)) {
    if (name.endsWith('.json')) fs.copyFileSync(path.join(source, name), path.join(target, name));
  }
}

function selectIndustryQuickReply(config) {
  const toolKeywords = (config.tools ?? []).flatMap(tool => tool.keywords ?? []);
  const actionKeywords = (config.actions ?? [])
    .filter(action => action.requiresOnline)
    .flatMap(action => action.keywords ?? []);
  const informationalPrefixes = [
    'how do i',
    'how to',
    'how can i',
    'can i',
    'where do i',
    'where can i',
    'what is the',
    'tell me how',
    'steps to',
    'way to',
    'also check',
    'also do',
  ];
  const reply = (config.quickReplies ?? []).find(candidate => {
    const value = String(candidate.value ?? '').toLowerCase();
    const callsTool = toolKeywords.some(keyword => value.includes(String(keyword).toLowerCase()));
    const informational = informationalPrefixes.some(prefix => value.includes(prefix));
    const callsLegacyAction =
      !informational &&
      actionKeywords.some(keyword => value.includes(String(keyword).toLowerCase()));
    return !callsTool && !callsLegacyAction;
  });
  if (!reply?.title) fail('recording_local_reply_missing');
  return reply.title;
}

function closeEnough(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

function validateRecording(recording, measured) {
  if (!recording || typeof recording !== 'object') fail('recording_record_invalid');
  if (!isCommit(recording.sourceCommit)) fail('recording_commit_missing');
  if (!REQUIRED_OUTPUTS.includes(normalized(recording.output))) {
    fail('recording_output_invalid', recording.output);
  }
  sizeLimitFor(recording.kind);

  const evidencePrefix = `tmp/recordings/${recording.sourceCommit}/`;
  if (!normalized(recording.source).startsWith(evidencePrefix)) {
    fail('recording_source_path_invalid', recording.source);
  }
  if (!normalized(recording.contactSheet).startsWith(evidencePrefix)) {
    fail('recording_contact_sheet_path_invalid', recording.contactSheet);
  }
  if (!normalized(recording.script).startsWith('scripts/')) fail('recording_script_invalid');
  if (!['android', 'ios', 'joint'].includes(recording.platform)) fail('recording_platform_invalid');
  if (typeof recording.os !== 'string' || !recording.os.trim()) fail('recording_os_missing');
  if (typeof recording.device !== 'string' || !recording.device.trim())
    fail('recording_device_missing');
  if (typeof recording.mode !== 'string' || !recording.mode.trim()) fail('recording_mode_missing');
  if (!nonEmptyString(recording.providerId)) fail('recording_provider_missing');
  if (!nonEmptyString(recording.modelIdentity)) fail('recording_model_identity_missing');
  if (!nonEmptyString(recording.captureCommand)) fail('recording_capture_command_missing');
  if (path.isAbsolute(recording.captureCommand) || recording.captureCommand.includes('/Users/')) {
    fail('recording_capture_command_invalid');
  }
  validateEvidenceClass(recording);
  if (
    !Number.isFinite(recording.playbackSpeed) ||
    recording.playbackSpeed < 1 ||
    recording.playbackSpeed > 8
  ) {
    fail('recording_playback_speed_invalid');
  }
  if (!Array.isArray(recording.omittedSourceRangesSeconds)) {
    fail('recording_omitted_range_invalid');
  }
  let previousEnd = -1;
  for (const range of recording.omittedSourceRangesSeconds) {
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !range.every(Number.isFinite) ||
      range[0] < 0 ||
      range[1] <= range[0] ||
      range[0] < previousEnd
    ) {
      fail('recording_omitted_range_invalid');
    }
    previousEnd = range[1];
  }
  if (typeof recording.config !== 'string' || !recording.config.trim())
    fail('recording_config_missing');
  if (!Number.isFinite(Date.parse(recording.capturedAt))) fail('recording_date_invalid');
  if (recording.loopReviewed !== true) fail('recording_loop_review_missing');

  if (!measured) return recording;
  const header = Buffer.isBuffer(measured.header)
    ? measured.header.subarray(0, 6).toString('ascii')
    : '';
  if (header !== 'GIF87a' && header !== 'GIF89a') fail('recording_gif_header_invalid');
  if (!Number.isInteger(measured.actualBytes) || measured.actualBytes <= 0)
    fail('recording_size_invalid');
  if (measured.actualBytes > sizeLimitFor(recording.kind)) fail('recording_size_limit');
  if (measured.actualBytes !== recording.bytes) fail('recording_size_mismatch');

  const probe = measured.probe ?? {};
  if (!Number.isInteger(probe.width) || !Number.isInteger(probe.height))
    fail('recording_dimensions_invalid');
  if (['platform', 'industry'].includes(recording.kind) && probe.width !== 360) {
    fail('recording_width_invalid');
  }
  if (probe.width !== recording.width || probe.height !== recording.height)
    fail('recording_dimensions_mismatch');
  if (![10, 12].some(fps => closeEnough(probe.fps, fps, 0.15)))
    fail('recording_frame_rate_invalid');
  if (!closeEnough(probe.fps, recording.fps, 0.15)) fail('recording_frame_rate_mismatch');
  if (
    !Number.isFinite(probe.durationSeconds) ||
    probe.durationSeconds < 2 ||
    probe.durationSeconds > 180
  ) {
    fail('recording_duration_invalid');
  }
  if (!closeEnough(probe.durationSeconds, recording.durationSeconds, 0.25)) {
    fail('recording_duration_mismatch');
  }
  return recording;
}

function validateManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 2 || !Array.isArray(manifest.recordings)) {
    fail('recording_manifest_invalid');
  }
  for (const recording of manifest.recordings) validateRecording(recording);
  const outputs = manifest.recordings.map(recording => normalized(recording.output));
  const duplicates = outputs.filter((output, index) => outputs.indexOf(output) !== index);
  if (duplicates.length) fail('recording_output_duplicate', duplicates[0]);
  const missing = REQUIRED_OUTPUTS.filter(output => !outputs.includes(output));
  if (missing.length) fail('recording_output_missing', missing[0]);
  return manifest;
}

module.exports = {
  README_GIF_OPTIONS,
  EVIDENCE_CLASSES,
  REQUIRED_OUTPUTS,
  SIZE_LIMITS,
  gifFilter,
  gifPaletteFilter,
  maestroRecordingPath,
  readmeLayoutFilter,
  replaceKnowledgeData,
  selectIndustryQuickReply,
  sizeLimitFor,
  validateManifest,
  validateRecording,
};
