import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root, sha256, readJson, loadPublicRecords} from './public-service.mjs';

export function verifyPublicArtifacts({requireReviewed = true} = {}) {
  assert.ok(
    fs.existsSync(path.join(root, 'demo/public-service/recordings.json')),
    'Five public-service captures NOT RUN: recording manifest is missing',
  );
  const manifest = readJson('demo/public-service/recordings.json');
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.sourceCommit ?? '', /^[a-f0-9]{40}$/);
  assert.ok(
    manifest.captureCommand?.includes('public-browser.py'),
    'Missing actual capture invocation',
  );
  for (const file of readJson('validation/public-service-lineage.json')) {
    assert.equal(
      manifest.codeFiles[file],
      sha256(fs.readFileSync(path.join(root, file))),
      `Capture source changed: ${file}`,
    );
    if (
      !['web/data/public-service.json', 'evidence/public-service/experiment.json'].includes(file)
    ) {
      assert.equal(
        manifest.committedFiles?.[file],
        manifest.codeFiles[file],
        `Capture source was not committed: ${file}`,
      );
      const committed = spawnSync('git', ['show', `${manifest.sourceCommit}:${file}`], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
      });
      assert.equal(committed.status, 0, `Capture commit does not contain ${file}`);
      assert.equal(
        sha256(committed.stdout),
        manifest.codeFiles[file],
        `Capture commit differs: ${file}`,
      );
    }
  }
  const required = [
    'demo-kit',
    'evidence-lab',
    'model-controls',
    'replay-pack',
    'source-workbench',
  ];
  assert.deepEqual(manifest.recordings.map(row => row.feature).sort(), required);
  const codeHash = sha256(fs.readFileSync(path.join(root, 'src/core/publicService.ts')));
  const corpusHash = sha256(JSON.stringify(loadPublicRecords()));
  for (const row of manifest.recordings) {
    assert.equal(row.coreSha256, codeHash, 'Capture is from a different core');
    assert.equal(row.corpusSha256, corpusHash, 'Capture is from different knowledge');
    assert.equal(row.playbackSpeed, 1);
    assert.deepEqual(row.editRangesSeconds, [[0, row.durationSeconds]]);
    assert.deepEqual(row.omittedSourceRangesSeconds, []);
    assert.ok(row.browser && row.beats.length >= 2);
    if (requireReviewed)
      assert.equal(row.loopReviewed, true, `${row.feature}: full loop NOT REVIEWED`);
    for (const [field, hashField] of [
      ['output', 'sha256'],
      ['shareMp4', 'shareMp4Sha256'],
    ]) {
      assert.match(row[field], /^demo\/public-service\/[a-z-]+\.(gif|mp4)$/);
      const bytes = fs.readFileSync(path.join(root, row[field]));
      assert.equal(sha256(bytes), row[hashField]);
      const probe = spawnSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-count_frames',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          row[field],
        ],
        {cwd: root, encoding: 'utf8'},
      );
      assert.equal(probe.status, 0, probe.stderr);
      const media = JSON.parse(probe.stdout);
      assert.ok(Number(media.streams[0].nb_read_frames) > 1, 'Static placeholder cannot pass');
      assert.ok(Number(media.streams[0].width) >= 900);
      assert.ok(Math.abs(Number(media.format.duration) - row.durationSeconds) < 0.25);
    }
    // Rebuilding on the capture host additionally verifies the uncut input. A
    // fresh checkout has the safe derived media and a hash-addressed lineage.
    assert.match(row.source, /^tmp\/recordings\/public-service\//);
    const raw = path.join(root, row.source);
    if (fs.existsSync(raw)) assert.equal(sha256(fs.readFileSync(raw)), row.sourceSha256);
    assert.ok(
      row.beats.every(
        beat =>
          beat.observedAtSeconds >= 0 &&
          beat.observedAtSeconds <= row.durationSeconds + 1 &&
          beat.visibleText &&
          beat.route &&
          beat.modelCalledDuringCapture === false,
      ),
    );
  }
  return manifest;
}
