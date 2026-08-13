const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function fail(code) {
  throw new Error(code);
}

function verifyModelFile(file, config) {
  if (!file) fail('provider_android_model_required');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('provider_android_model_missing');
  if (path.basename(file) !== config.filename) fail('provider_android_model_filename_invalid');
  const sizeBytes = fs.statSync(file).size;
  if (sizeBytes !== config.sizeBytes) fail('provider_android_model_size_invalid');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sha256 !== config.sha256) fail('provider_android_model_sha256_invalid');
  return {file, filename: config.filename, sizeBytes, sha256};
}

function placementCommands({adb = 'adb', device, model}) {
  const temporary = `/data/local/tmp/${model.filename}`;
  const prefix = [adb, '-s', device];
  return {
    temporary,
    steps: [
      {command: prefix[0], args: [...prefix.slice(1), 'push', model.file, temporary]},
      {command: prefix[0], args: [...prefix.slice(1), 'shell', 'chmod', '644', temporary]},
      {
        command: prefix[0],
        args: [...prefix.slice(1), 'shell', 'run-as', 'com.airgap', 'mkdir', '-p', 'files/models'],
      },
      {
        command: prefix[0],
        args: [
          ...prefix.slice(1),
          'shell',
          'run-as',
          'com.airgap',
          'cp',
          temporary,
          `files/models/${model.filename}`,
        ],
      },
      {
        command: prefix[0],
        args: [
          ...prefix.slice(1),
          'shell',
          'run-as',
          'com.airgap',
          'sha256sum',
          `files/models/${model.filename}`,
        ],
        capture: true,
      },
    ],
    cleanup: {
      command: prefix[0],
      args: [...prefix.slice(1), 'shell', 'rm', '-f', temporary],
    },
  };
}

module.exports = {placementCommands, verifyModelFile};
