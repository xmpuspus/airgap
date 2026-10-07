const {Buffer} = require('node:buffer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function fail(code) {
  throw new Error(code);
}

// Node cannot read a file over 2 GiB into one buffer, and the model is 2.4 GB.
function sha256File(file, chunkBytes = 64 * 1024 * 1024) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(chunkBytes);
  const descriptor = fs.openSync(file, 'r');
  try {
    let read = fs.readSync(descriptor, buffer, 0, chunkBytes, null);
    while (read > 0) {
      hash.update(buffer.subarray(0, read));
      read = fs.readSync(descriptor, buffer, 0, chunkBytes, null);
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function verifyModelFile(file, config) {
  if (!file) fail('provider_android_model_required');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('provider_android_model_missing');
  if (path.basename(file) !== config.filename) fail('provider_android_model_filename_invalid');
  const sizeBytes = fs.statSync(file).size;
  if (sizeBytes !== config.sizeBytes) fail('provider_android_model_size_invalid');
  const sha256 = sha256File(file);
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

module.exports = {placementCommands, sha256File, verifyModelFile};
