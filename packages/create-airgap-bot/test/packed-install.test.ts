import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scaffold} from '../src/scaffold';

describe('packaged template', () => {
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
