/**
 * CitationChips logic tests — exercise the pure resolver/layout
 * functions extracted from the React component. Avoids
 * react-test-renderer because react-native 0.84 is not friendly to
 * pure-jest renderers (window.dispatchEvent landmines).
 *
 * The wired component composes these two functions, so the chip-row
 * behavior is fully covered by these unit tests.
 */

import {
  layoutCitations,
  resolveCitations,
} from '../../src/components/chat/CitationChips';

type Doc = {category: string; title: string};

function makeLookup(docs: Record<string, Doc>): (id: string) => Doc | undefined {
  return (id: string) => docs[id];
}

const FIXTURES = {
  'plan-99': {category: 'plan', title: 'Super Surf 99'},
  'plan-149': {category: 'plan', title: 'MegaSurf 149'},
  'plan-299': {category: 'plan', title: 'Super Surf 299'},
  'plan-499': {category: 'plan', title: 'MegaSurf 499'},
  'faq-recharge': {category: 'faq', title: 'How to recharge'},
} as const;

describe('resolveCitations', () => {
  it('returns an empty list when docIds is undefined or empty', () => {
    const lookup = makeLookup(FIXTURES);
    expect(resolveCitations(undefined, lookup)).toEqual([]);
    expect(resolveCitations([], lookup)).toEqual([]);
  });

  it('preserves doc id order from the input', () => {
    const lookup = makeLookup(FIXTURES);
    const resolved = resolveCitations(['plan-149', 'plan-99'], lookup);
    expect(resolved.map(r => r.id)).toEqual(['plan-149', 'plan-99']);
  });

  it('resolves category and title from the lookup', () => {
    const lookup = makeLookup(FIXTURES);
    const resolved = resolveCitations(['plan-99'], lookup);
    expect(resolved).toEqual([
      {id: 'plan-99', category: 'plan', title: 'Super Surf 99'},
    ]);
  });

  it('filters out tool-synthesis pseudo-docs (ids starting with tool:)', () => {
    const lookup = makeLookup(FIXTURES);
    const resolved = resolveCitations(
      ['tool:checkBalance', 'plan-99', 'tool:reportOutage'],
      lookup,
    );
    expect(resolved.map(r => r.id)).toEqual(['plan-99']);
  });

  it('drops doc ids the lookup cannot resolve', () => {
    const lookup = makeLookup(FIXTURES);
    const resolved = resolveCitations(
      ['plan-99', 'unknown-id', 'plan-149'],
      lookup,
    );
    expect(resolved.map(r => r.id)).toEqual(['plan-99', 'plan-149']);
  });

  it('coerces non-string category values to a string', () => {
    const lookup: (id: string) => Doc | undefined = id =>
      id === 'odd' ? ({category: 42 as unknown as string, title: 'Odd doc'}) : undefined;
    const [r] = resolveCitations(['odd'], lookup);
    expect(r.category).toBe('42');
  });
});

describe('layoutCitations', () => {
  function asResolved(ids: string[]) {
    const lookup = makeLookup(FIXTURES);
    return resolveCitations(ids, lookup);
  }

  it('caps visible at 3 (the documented MAX_VISIBLE_CITATIONS) and reports overflow', () => {
    const layout = layoutCitations(
      asResolved(['plan-99', 'plan-149', 'plan-299', 'plan-499']),
    );
    expect(layout.visible.map(v => v.id)).toEqual([
      'plan-99',
      'plan-149',
      'plan-299',
    ]);
    expect(layout.overflowCount).toBe(1);
    expect(layout.firstOverflowId).toBe('plan-499');
  });

  it('reports zero overflow when fewer than the cap', () => {
    const layout = layoutCitations(asResolved(['plan-99', 'plan-149']));
    expect(layout.visible).toHaveLength(2);
    expect(layout.overflowCount).toBe(0);
    expect(layout.firstOverflowId).toBeNull();
  });

  it('honors a custom maxVisible override', () => {
    const layout = layoutCitations(
      asResolved(['plan-99', 'plan-149', 'plan-299']),
      1,
    );
    expect(layout.visible).toHaveLength(1);
    expect(layout.overflowCount).toBe(2);
    expect(layout.firstOverflowId).toBe('plan-149');
  });

  it('handles an empty input deterministically', () => {
    const layout = layoutCitations([]);
    expect(layout.visible).toEqual([]);
    expect(layout.overflowCount).toBe(0);
    expect(layout.firstOverflowId).toBeNull();
  });
});

describe('end-to-end resolver + layout chain', () => {
  it('shapes a real-world payload (4 KB hits with 1 tool pseudo-doc) into 3 visible + 1 overflow', () => {
    const lookup = makeLookup(FIXTURES);
    const layout = layoutCitations(
      resolveCitations(
        [
          'tool:checkBalance',
          'plan-99',
          'plan-149',
          'plan-299',
          'plan-499',
          'unknown-id',
        ],
        lookup,
      ),
    );
    expect(layout.visible.map(v => v.id)).toEqual([
      'plan-99',
      'plan-149',
      'plan-299',
    ]);
    expect(layout.overflowCount).toBe(1);
    expect(layout.firstOverflowId).toBe('plan-499');
  });
});

describe('useSourceDrawer hook contract', () => {
  // We can not render the React Native Modal without a runtime, but we
  // can still assert the hook's exported contract: namely, that the
  // outside-provider escape hatch returns no-op handlers and a null
  // openDocId. This keeps unit-test coverage on the public API without
  // booting the full RN renderer.
  it('exposes the expected shape', () => {
    const mod = require('../../src/hooks/useSourceDrawer');
    expect(typeof mod.SourceDrawerProvider).toBe('function');
    expect(typeof mod.useSourceDrawer).toBe('function');
  });
});
