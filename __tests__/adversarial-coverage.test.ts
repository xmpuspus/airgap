/**
 * Adversarial coverage test — asserts every vertical ships with at least
 * 10 seeded attack cases in __tests__/golden/adversarial.json, and that
 * every "expect: refusal" entry matches a blocklist phrase in the matching
 * vertical's airgap.config.json.
 *
 * This is a completeness gate. It doesn't run the LLM — it just checks the
 * fixtures are there and consistent with config. The real LLM journey
 * evaluation lives in __tests__/run-llm-journeys.mjs.
 */

import fs from 'fs';
import path from 'path';

interface Case {
  query: string;
  expect: string;
  reason?: string;
  tool?: string;
}

interface Fixture {
  verticals: Record<string, Case[]>;
}

const fixturePath = path.join(__dirname, 'golden', 'adversarial.json');
const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

const exampleConfigs: Record<string, any> = {};
for (const vertical of Object.keys(fixture.verticals)) {
  const configPath = path.join(
    __dirname,
    '..',
    'examples',
    vertical,
    'airgap.config.json',
  );
  if (fs.existsSync(configPath)) {
    exampleConfigs[vertical] = JSON.parse(
      fs.readFileSync(configPath, 'utf-8'),
    );
  }
}

describe('adversarial coverage', () => {
  test('every vertical has at least 10 seeded cases', () => {
    for (const [_vertical, cases] of Object.entries(fixture.verticals)) {
      expect(cases.length).toBeGreaterThanOrEqual(10);
      // Each case needs a query and an expected outcome
      for (const c of cases) {
        expect(c.query).toBeTruthy();
        expect(c.expect).toBeTruthy();
      }
    }
  });

  test('every "refusal" case ties to a blocklist phrase or refusal reason', () => {
    for (const [vertical, cases] of Object.entries(fixture.verticals)) {
      const cfg = exampleConfigs[vertical];
      if (!cfg) continue; // Vertical without an example config gets skipped
      const blocklist: string[] = cfg.safety?.topicBlocklist ?? [];
      const blocklistPhrases = blocklist.map(entry => {
        const parts = entry.split(':', 2);
        return (parts.length === 2 ? parts[1] : parts[0]).toLowerCase();
      });

      for (const c of cases.filter(x => x.expect === 'refusal')) {
        const matches = blocklistPhrases.some(phrase =>
          c.query.toLowerCase().includes(phrase),
        );
        if (!matches) {
          // Fail loudly with diagnostic info
          throw new Error(
            `Vertical "${vertical}" has adversarial case "${c.query}" ` +
              `marked as refusal but no blocklist phrase in that vertical's ` +
              `config matches it. Blocklist phrases: ` +
              `${JSON.stringify(blocklistPhrases)}`,
          );
        }
      }
    }
  });

  test('every "tool" case references a tool defined in the vertical config', () => {
    for (const [vertical, cases] of Object.entries(fixture.verticals)) {
      const cfg = exampleConfigs[vertical];
      if (!cfg) continue;
      const toolNames: string[] = (cfg.tools ?? []).map((t: any) => t.name);
      for (const c of cases.filter(x => x.expect === 'tool')) {
        if (!c.tool) {
          throw new Error(
            `Vertical "${vertical}" has tool-case "${c.query}" with no tool name`,
          );
        }
        expect(toolNames).toContain(c.tool);
      }
    }
  });
});
