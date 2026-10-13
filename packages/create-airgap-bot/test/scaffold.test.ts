import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scaffold} from '../src/scaffold';
import {deriveNames} from '../src/rename';

// The repo root: <repo>/packages/create-airgap-bot/test/scaffold.test.ts -> ../../..
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('scaffold', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'airgap-scaffold-test-'));
  });

  afterAll(async () => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      await fsp.rm(tmpDir, {recursive: true, force: true});
    }
  });

  it('scaffolds a telco bot from the local source tree', async () => {
    const botName = 'acme-support';
    const targetDir = path.join(tmpDir, botName);

    await scaffold({
      botName,
      template: 'telco',
      targetDir,
      sourceDir: REPO_ROOT,
    });

    expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'airgap.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'android'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'ios'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'tmp'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'coverage'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'android', 'app', '.cxx'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'android', 'app', 'build'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'ios', 'Pods'))).toBe(false);

    const pkg = JSON.parse(await fsp.readFile(path.join(targetDir, 'package.json'), 'utf8')) as {
      name: string;
    };
    expect(pkg.name).toBe(botName);

    const gradle = await fsp.readFile(
      path.join(targetDir, 'android', 'app', 'build.gradle'),
      'utf8',
    );
    const {androidPackage} = deriveNames(botName);
    expect(gradle).toContain(`applicationId "${androidPackage}"`);
    expect(gradle).toContain(`namespace "${androidPackage}"`);
    // Old package id must be gone.
    expect(gradle).not.toContain('com.airgap');

    const scaffolded = JSON.parse(
      await fsp.readFile(path.join(targetDir, 'airgap.config.json'), 'utf8'),
    );
    const templateCfg = JSON.parse(
      await fsp.readFile(path.join(REPO_ROOT, 'examples', 'telco', 'airgap.config.json'), 'utf8'),
    );
    // The scaffolder points $schema at the app root; every other field is copied as is.
    expect(scaffolded).toEqual({...templateCfg, $schema: './airgap.schema.json'});
    expect(fs.existsSync(path.join(targetDir, 'src', 'knowledge', 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'src', 'knowledge', 'plans.json'))).toBe(true);

    const newJavaDir = path.join(
      targetDir,
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      deriveNames(botName).packageSlug,
    );
    expect(fs.existsSync(newJavaDir)).toBe(true);
    const oldJavaDir = path.join(
      targetDir,
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      'airgap',
    );
    expect(fs.existsSync(oldJavaDir)).toBe(false);

    const appJson = JSON.parse(await fsp.readFile(path.join(targetDir, 'app.json'), 'utf8')) as {
      name: string;
      displayName: string;
    };
    expect(appJson.name).toBe(deriveNames(botName).pascalName);
    expect(appJson.displayName).toBe(deriveNames(botName).pascalName);

    expect(fs.existsSync(path.join(targetDir, 'ios', deriveNames(botName).pascalName))).toBe(true);
    expect(
      fs.existsSync(path.join(targetDir, 'ios', `${deriveNames(botName).pascalName}.xcodeproj`)),
    ).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'ios', 'Airgap'))).toBe(false);

    expect(fs.existsSync(path.join(targetDir, '.airgap-scaffold.json'))).toBe(true);
  }, 60000);

  it('points $schema at the schema file in the app root', async () => {
    const targetDir = path.join(tmpDir, 'bank-support');

    await scaffold({
      botName: 'bank-support',
      template: 'banking',
      targetDir,
      sourceDir: REPO_ROOT,
    });

    const scaffolded = JSON.parse(
      await fsp.readFile(path.join(targetDir, 'airgap.config.json'), 'utf8'),
    );
    expect(scaffolded.$schema).toBe('./airgap.schema.json');
    expect(fs.existsSync(path.join(targetDir, 'airgap.schema.json'))).toBe(true);
  }, 60000);
});

describe('deriveNames', () => {
  it('produces kebab/Pascal/slug variants', () => {
    expect(deriveNames('acme-support')).toEqual({
      npmName: 'acme-support',
      pascalName: 'AcmeSupport',
      packageSlug: 'acmesupport',
      androidPackage: 'com.acmesupport',
    });
  });

  it('handles single-word names', () => {
    expect(deriveNames('mybot')).toEqual({
      npmName: 'mybot',
      pascalName: 'Mybot',
      packageSlug: 'mybot',
      androidPackage: 'com.mybot',
    });
  });
});
