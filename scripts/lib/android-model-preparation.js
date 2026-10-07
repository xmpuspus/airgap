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

// The file streams through `adb shell` into the app directory. A push to
// /data/local/tmp plus a copy needs twice the model size on the data partition,
// which a default emulator does not have. `adb exec-in` truncates binary input,
// so the stream uses the plain shell with the file on stdin.
function placementCommands({adb = 'adb', device, model}) {
  const target = `files/models/${model.filename}`;
  const prefix = ['-s', device, 'shell', 'run-as', 'com.airgap'];
  return {
    steps: [
      {command: adb, args: [...prefix, 'mkdir', '-p', 'files/models']},
      {
        command: adb,
        args: ['-s', device, 'shell', `run-as com.airgap sh -c 'cat > ${target}'`],
        stdinFile: model.file,
      },
      {command: adb, args: [...prefix, 'sha256sum', target], capture: true},
    ],
  };
}

module.exports = {placementCommands, verifyModelFile};
