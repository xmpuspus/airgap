// The model file is 2.4 GB and a default emulator data partition has about
// 4.5 GB free, so a push to /data/local/tmp followed by a copy runs out of
// space. The placement streams the file straight into the app directory.

const {placementCommands} = require('../../scripts/lib/android-model-preparation.js');

describe('android model placement', () => {
  test('streams the file into the app directory without a device-side copy', () => {
    const commands = placementCommands({
      adb: '/sdk/adb',
      device: 'emulator-5554',
      model: {file: '/models/m.gguf', filename: 'm.gguf', sha256: 'abc'},
    });
    expect(commands.steps.map(step => [step.command, ...step.args].join(' '))).toEqual([
      '/sdk/adb -s emulator-5554 shell run-as com.airgap mkdir -p files/models',
      "/sdk/adb -s emulator-5554 shell run-as com.airgap sh -c 'cat > files/models/m.gguf'",
      '/sdk/adb -s emulator-5554 shell run-as com.airgap sha256sum files/models/m.gguf',
    ]);
    expect(commands.steps[1].stdinFile).toBe('/models/m.gguf');
    expect(commands.steps[2].capture).toBe(true);
    expect(commands.cleanup).toBeUndefined();
    expect(JSON.stringify(commands)).not.toContain('/data/local/tmp');
  });
});
