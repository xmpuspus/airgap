const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let runner = {};
let preflight = {};
let model = {};
try {
  runner = require('../../scripts/lib/provider-runner.js');
  preflight = require('../../scripts/lib/provider-device-preflight.js');
  model = require('../../scripts/lib/android-model-preparation.js');
} catch {
  // The first TDD run reaches the export assertion before the modules exist.
}

describe('provider scenario runner commands', () => {
  test('exports runner, preflight, and model preparation contracts', () => {
    expect(typeof runner.iosLaunchCommand).toBe('function');
    expect(typeof runner.androidLaunchCommand).toBe('function');
    expect(typeof runner.maestroValues).toBe('function');
    expect(typeof preflight.assessAndroidTarget).toBe('function');
    expect(typeof preflight.assessIosTarget).toBe('function');
    expect(typeof model.verifyModelFile).toBe('function');
  });

  test('builds the exact iOS Simulator launch arguments', () => {
    if (!runner.iosLaunchCommand) return;
    expect(
      runner.iosLaunchCommand({
        device: 'SIM-UDID',
        appId: 'org.reactjs.native.example.Airgap',
        scenario: 'available',
      }),
    ).toEqual({
      command: 'xcrun',
      args: [
        'simctl',
        'launch',
        '--terminate-running-process',
        'SIM-UDID',
        'org.reactjs.native.example.Airgap',
        '-AirgapProviderScenario',
        'available',
      ],
    });
  });

  test('builds the exact Android activity launch arguments', () => {
    if (!runner.androidLaunchCommand) return;
    expect(runner.androidLaunchCommand({device: 'emulator-5554', scenario: 'busy'})).toEqual({
      command: 'adb',
      args: [
        '-s',
        'emulator-5554',
        'shell',
        'am',
        'start',
        '-S',
        '-n',
        'com.airgap/.MainActivity',
        '--es',
        'airgapProviderScenario',
        'busy',
      ],
    });
  });

  test('passes provider expectations to Maestro', () => {
    if (!runner.maestroValues) return;
    expect(
      runner.maestroValues({
        platform: 'ios',
        appId: 'org.reactjs.native.example.Airgap',
        scenario: {
          id: 'available',
          capabilities: {ios: {state: 'available'}},
          generation: {text: 'Local answer'},
        },
      }),
    ).toEqual({
      APP_ID: 'org.reactjs.native.example.Airgap',
      PROVIDER_NAME: 'Apple on-device model',
      PROVIDER_STATE: 'Ready',
      EXPECTED_RESULT: 'Local answer',
    });
  });
});

describe('target-device preflight', () => {
  test('detects Android emulators and refuses target evidence', () => {
    if (!preflight.assessAndroidTarget) return;
    expect(() =>
      preflight.assessAndroidTarget({
        serial: 'emulator-5554',
        model: 'sdk_gphone64_arm64',
        fingerprint: 'google/sdk_gphone64_arm64/emu64a:15/test-keys',
        qemu: '1',
        aicorePackage: '',
      }),
    ).toThrow('provider_target_android_virtual');
  });

  test('requires AICore on a physical Android target', () => {
    if (!preflight.assessAndroidTarget) return;
    expect(() =>
      preflight.assessAndroidTarget({
        serial: 'R5CX123456A',
        model: 'Pixel 9 Pro',
        fingerprint: 'google/komodo/komodo:16/BP2A/release-keys',
        qemu: '0',
        aicorePackage: '',
      }),
    ).toThrow('provider_target_android_aicore_missing');
  });

  test('rejects Simulator UDIDs as iOS target evidence', () => {
    if (!preflight.assessIosTarget) return;
    expect(() => preflight.assessIosTarget({udid: 'SIM', simulator: true})).toThrow(
      'provider_target_ios_simulator',
    );
  });

  test('requires gcloud and a physical Firebase model', () => {
    if (!preflight.assessFirebaseTarget) return;
    expect(() =>
      preflight.assessFirebaseTarget({gcloudPath: undefined, project: 'airgap', model: 'komodo'}),
    ).toThrow('provider_firebase_gcloud_missing');
    expect(() =>
      preflight.assessFirebaseTarget({
        gcloudPath: '/opt/google-cloud-sdk/bin/gcloud',
        project: 'airgap',
        model: 'virtual',
      }),
    ).toThrow('provider_firebase_physical_model_required');
  });
});

describe('Android model preparation', () => {
  let directory;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'airgap-model-test-'));
  });

  afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
  });

  test('rejects a missing model path', () => {
    if (!model.verifyModelFile) return;
    expect(() => model.verifyModelFile(undefined, {})).toThrow('provider_android_model_required');
  });

  test('checks configured filename and byte size before hashing', () => {
    if (!model.verifyModelFile) return;
    const file = path.join(directory, 'wrong.gguf');
    fs.writeFileSync(file, 'abcd');
    expect(() =>
      model.verifyModelFile(file, {
        filename: 'model.gguf',
        sizeBytes: 4,
        sha256: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      }),
    ).toThrow('provider_android_model_filename_invalid');

    const named = path.join(directory, 'model.gguf');
    fs.writeFileSync(named, 'abc');
    expect(() =>
      model.verifyModelFile(named, {
        filename: 'model.gguf',
        sizeBytes: 4,
        sha256: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      }),
    ).toThrow('provider_android_model_size_invalid');
  });

  test('rejects the wrong SHA-256 and accepts matching bytes', () => {
    if (!model.verifyModelFile) return;
    const file = path.join(directory, 'model.gguf');
    fs.writeFileSync(file, 'abcd');
    expect(() =>
      model.verifyModelFile(file, {
        filename: 'model.gguf',
        sizeBytes: 4,
        sha256: '0'.repeat(64),
      }),
    ).toThrow('provider_android_model_sha256_invalid');
    expect(
      model.verifyModelFile(file, {
        filename: 'model.gguf',
        sizeBytes: 4,
        sha256: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      }),
    ).toMatchObject({sizeBytes: 4});
  });
});
