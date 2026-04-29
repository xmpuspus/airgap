/**
 * Golden eval set coverage — verifies that every per-vertical golden file
 * exists, has at least 10 cases, and that any case with an `expectTool`
 * field actually resolves to that tool against the corresponding example
 * config. This catches keyword drift between the goldens and the configs.
 */

import {readFileSync, existsSync} from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '..');
const VERTICALS = [
  'telco',
  'banking',
  'healthcare',
  'airline',
  'insurance',
  'electric-utility',
  'water-utility',
] as const;

interface ToolDef {
  name: string;
  keywords: string[];
}

interface GoldenCase {
  id: string;
  query: string;
  mustInclude?: string[];
  expectTool?: string;
  expectRefusal?: string;
}

interface GoldenFile {
  vertical: string;
  description: string;
  cases: GoldenCase[];
}

function matchesKeyword(query: string, keyword: string): boolean {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  return re.test(query.toLowerCase());
}

function findTool(query: string, tools: ToolDef[]): ToolDef | null {
  for (const t of tools) {
    for (const kw of t.keywords) {
      if (matchesKeyword(query, kw)) return t;
    }
  }
  return null;
}

function loadGolden(vertical: string): GoldenFile {
  const p = path.join(REPO_ROOT, '__tests__/golden', `${vertical}.json`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function loadExampleTools(vertical: string): ToolDef[] {
  const p = path.join(REPO_ROOT, 'examples', vertical, 'airgap.config.json');
  const cfg = JSON.parse(readFileSync(p, 'utf-8'));
  return cfg.tools ?? [];
}

describe('per-vertical golden coverage', () => {
  for (const vertical of VERTICALS) {
    describe(vertical, () => {
      const goldenPath = path.join(
        REPO_ROOT,
        '__tests__/golden',
        `${vertical}.json`,
      );

      test('golden file exists', () => {
        expect(existsSync(goldenPath)).toBe(true);
      });

      const golden = loadGolden(vertical);
      const tools = loadExampleTools(vertical);

      test('has at least 10 cases', () => {
        expect(golden.cases.length).toBeGreaterThanOrEqual(10);
      });

      test('every expectTool case resolves to that tool', () => {
        for (const c of golden.cases) {
          if (!c.expectTool) continue;
          const resolved = findTool(c.query, tools);
          expect(resolved).not.toBeNull();
          expect(resolved?.name).toBe(c.expectTool);
        }
      });
    });
  }
});
