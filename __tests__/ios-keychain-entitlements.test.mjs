import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test(
  'gives iOS simulator builds an entitlement input for private Keychain access',
  {skip: process.platform !== 'darwin'},
  () => {
    const result = spawnSync(
      'xcodebuild',
      [
        '-workspace',
        'ios/Airgap.xcworkspace',
        '-scheme',
        'Airgap',
        '-sdk',
        'iphonesimulator',
        '-configuration',
        'Debug',
        '-showBuildSettings',
      ],
      {cwd: root, encoding: 'utf8'},
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /CODE_SIGN_ENTITLEMENTS = Airgap\/Airgap\.entitlements/);

    const plist = spawnSync('plutil', ['-lint', 'ios/Airgap/Airgap.entitlements'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(plist.status, 0, plist.stderr);
  },
);
