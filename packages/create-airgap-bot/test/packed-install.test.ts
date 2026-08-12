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
    } finally {
      global.fetch = originalFetch;
      await fsp.rm(targetRoot, {recursive: true, force: true});
    }
  });
});
