// Every shipped template must pass the same startup validation as the root
// config, opt into demo mode, and ship a knowledge directory with records.

import {existsSync, readFileSync, readdirSync} from 'fs';
import path from 'path';
import {validateConfig} from '../src/config/validate';

const EXAMPLES = path.join(__dirname, '..', 'examples');
const templates = readdirSync(EXAMPLES).filter(name =>
  existsSync(path.join(EXAMPLES, name, 'airgap.config.json')),
);

describe.each(templates)('examples/%s', template => {
  const cfg = JSON.parse(readFileSync(path.join(EXAMPLES, template, 'airgap.config.json'), 'utf8'));

  test('passes validateConfig', () => {
    const result = validateConfig(cfg);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('names a brand, a bot, a hotline, and at least one quick reply', () => {
    expect(cfg.brand.name).toBeTruthy();
    expect(cfg.brand.botName).toBeTruthy();
    expect(cfg.brand.hotline).toBeTruthy();
    expect(cfg.quickReplies.length).toBeGreaterThan(0);
  });

  test('starts in demo mode with the demo provider enabled', () => {
    const providers: Array<{id: string; enabled: boolean}> = cfg.llm.providers;
    expect(cfg.llm.mode).toBe('demo');
    expect(providers.some(p => p.id === 'demo' && p.enabled)).toBe(true);
  });

  test('ships knowledge records', () => {
    const dir = path.join(EXAMPLES, template, 'knowledge');
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    const total = files.reduce(
      (sum, f) => sum + JSON.parse(readFileSync(path.join(dir, f), 'utf8')).length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });
});
