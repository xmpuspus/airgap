#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export const PUBLIC_SITE_MEDIA_DIRECTORY = 'web/assets/gifs/public-service';
const FEATURES = ['replay-pack', 'evidence-lab', 'source-workbench', 'model-controls', 'demo-kit'];
const FORMATS = [
  {extension: '.gif', pathField: 'output', hashField: 'sha256'},
  {extension: '.mp4', pathField: 'shareMp4', hashField: 'shareMp4Sha256'},
];

function writeIfChanged(target, bytes) {
  if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) return;
  fs.writeFileSync(target, bytes);
}

export function syncPublicSiteAssets(projectRoot = root, {required = true} = {}) {
  const manifestPath = path.join(projectRoot, 'demo/public-service/recordings.json');
  if (!fs.existsSync(manifestPath) && !required) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const recordings = manifest.recordings ?? [];
  const byFeature = new Map(recordings.map(recording => [recording.feature, recording]));
  const expectedFeatures = [...FEATURES].sort();
  const actualFeatures = [...byFeature.keys()].sort();
  if (
    manifest.schemaVersion !== 1 ||
    recordings.length !== FEATURES.length ||
    JSON.stringify(actualFeatures) !== JSON.stringify(expectedFeatures)
  )
    throw new Error('Expected one recording for each of the five public features.');

  const destinationDirectory = path.join(projectRoot, PUBLIC_SITE_MEDIA_DIRECTORY);
  fs.mkdirSync(destinationDirectory, {recursive: true});
  const published = [];
  for (const feature of FEATURES) {
    const recording = byFeature.get(feature);
    for (const format of FORMATS) {
      const expectedSource = `demo/public-service/${feature}${format.extension}`;
      if (recording[format.pathField] !== expectedSource)
        throw new Error(`Unexpected public media path: ${recording[format.pathField]}`);
      const source = path.join(projectRoot, expectedSource);
      const bytes = fs.readFileSync(source);
      const actualHash = sha256(bytes);
      if (actualHash !== recording[format.hashField])
        throw new Error(`Public media hash mismatch: ${expectedSource}`);
      const sitePath = `${PUBLIC_SITE_MEDIA_DIRECTORY}/${path.basename(expectedSource)}`;
      writeIfChanged(path.join(projectRoot, sitePath), bytes);
      published.push({feature, source: expectedSource, sitePath, sha256: actualHash});
    }
  }
  return published;
}
