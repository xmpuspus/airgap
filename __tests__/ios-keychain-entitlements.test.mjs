import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
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
    assert.match(result.stdout, /CODE_SIGN_ENTITLEMENTS = Airgap\/AirgapSimulator\.entitlements/);

    const plist = spawnSync('plutil', ['-lint', 'ios/Airgap/Airgap.entitlements'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(plist.status, 0, plist.stderr);

    const accessGroup = spawnSync(
      'plutil',
      ['-extract', 'keychain-access-groups.0', 'raw', 'ios/Airgap/Airgap.entitlements'],
      {cwd: root, encoding: 'utf8'},
    );
    assert.equal(accessGroup.status, 0, accessGroup.stderr);
    assert.equal(accessGroup.stdout.trim(), '$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)');

    const simulatorAccessGroup = spawnSync(
      'plutil',
      ['-extract', 'keychain-access-groups.0', 'raw', 'ios/Airgap/AirgapSimulator.entitlements'],
      {cwd: root, encoding: 'utf8'},
    );
    assert.equal(simulatorAccessGroup.status, 0, simulatorAccessGroup.stderr);
    assert.equal(
      simulatorAccessGroup.stdout.trim(),
      '$(TeamIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)',
    );

    const project = fs.readFileSync('ios/Airgap.xcodeproj/project.pbxproj', 'utf8');
    assert.match(project, /com\.apple\.Keychain = \{\s*enabled = 1;/);
  },
);
