import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const gradleProperties = await readFile(
  new URL('../android/gradle.properties', import.meta.url),
  'utf8',
);
const appGradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const deployment = await readFile(new URL('../DEPLOYMENT.md', import.meta.url), 'utf8');

test('keeps Android release signing secrets out of tracked properties', () => {
  assert.doesNotMatch(gradleProperties, /^AIRGAP_RELEASE_/m);
});

test('reads every Android release signing value from the environment', () => {
  for (const name of [
    'AIRGAP_RELEASE_STORE_FILE',
    'AIRGAP_RELEASE_KEY_ALIAS',
    'AIRGAP_RELEASE_STORE_PASSWORD',
    'AIRGAP_RELEASE_KEY_PASSWORD',
  ]) {
    assert.match(appGradle, new RegExp(`System\\.getenv\\('${name}'\\)`));
    assert.match(deployment, new RegExp(`export ${name}=`));
  }
});

test('signs a release only when all four environment values are present', () => {
  assert.match(appGradle, /releaseSigningConfigured/);
  assert.match(appGradle, /if \(releaseSigningConfigured\)/);
});
