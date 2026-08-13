import {execFileSync} from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scaffold} from '../src/scaffold';

describe('packaged template', () => {
  test('copies only version-controlled template sources', async () => {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const sentinel = path.join(repositoryRoot, 'scripts', '.airgap-untracked-template-sentinel');
    const templateRoot = path.join(repositoryRoot, 'packages', 'create-airgap-bot', 'template');

    await fsp.writeFile(sentinel, 'local-only fixture\n');
    try {
      execFileSync(
        process.execPath,
        [path.join(__dirname, '..', 'scripts', 'build-template.mjs')],
        {
          cwd: repositoryRoot,
        },
      );
      await expect(
        fsp.access(path.join(templateRoot, 'scripts', path.basename(sentinel))),
      ).rejects.toThrow();
      await expect(
        fsp.access(path.join(templateRoot, 'android', 'local.properties')),
      ).rejects.toThrow();
      await expect(
        fsp.access(path.join(templateRoot, 'ios', '.xcode.env.local')),
      ).rejects.toThrow();
      await expect(
        fsp.access(path.join(templateRoot, 'ios', 'Airgap', 'Airgap.entitlements')),
      ).resolves.toBeUndefined();
      await expect(
        fsp.access(path.join(templateRoot, 'ios', 'Airgap', 'AirgapSimulator.entitlements')),
      ).resolves.toBeUndefined();
      for (const relativePath of [
        'validation/provider-scenarios.json',
        'ios/Airgap/ProviderHarness.swift',
        'android/app/src/main/java/com/airgap/inference/ProviderHarness.kt',
        'scripts/run-provider-scenario.mjs',
        'scripts/provider-device-preflight.mjs',
        'scripts/validate-provider-evidence.mjs',
        'docs/provider-validation.md',
      ]) {
        await expect(fsp.access(path.join(templateRoot, relativePath))).resolves.toBeUndefined();
      }
    } finally {
      await fsp.rm(sentinel, {force: true});
    }
  });

  test('scaffolds with network access disabled', async () => {
    const targetRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'airgap-packed-test-'));
    const targetDir = path.join(targetRoot, 'field-help');
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => {
      throw new Error('network called');
    }) as typeof fetch;

    try {
      await scaffold({
        botName: 'field-help',
        template: 'water-utility',
        targetDir,
      });
      expect(global.fetch).not.toHaveBeenCalled();
      const config = JSON.parse(
        await fsp.readFile(path.join(targetDir, 'airgap.config.json'), 'utf8'),
      ) as {brand: {name: string}};
      expect(config.brand.name).toBe('AquaFlow Water');
      await expect(
        fsp.access(path.join(targetDir, 'src', 'knowledge', 'index.ts')),
      ).resolves.toBeUndefined();
      await expect(
        fsp.access(path.join(targetDir, 'src', 'knowledge', 'plans.json')),
      ).rejects.toThrow();
      const manifest = await fsp.readFile(
        path.join(targetDir, 'src', 'knowledge', 'manifest.ts'),
        'utf8',
      );
      expect(manifest).toContain("import services from './services.json';");
      expect(manifest).not.toContain("'./plans.json'");
      await expect(fsp.access(path.join(targetDir, 'android', 'app', '.cxx'))).rejects.toThrow();
      await expect(fsp.access(path.join(targetDir, 'android', 'app', 'build'))).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
      await fsp.rm(targetRoot, {recursive: true, force: true});
    }
  });
});
