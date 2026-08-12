import {
  getHeaderLayout,
  getInputToolbarLayout,
  getOperatingStateLayout,
} from '../../src/utils/responsiveLayout';

describe('large-text responsive layouts', () => {
  test('keeps the standard horizontal layout at the default text scale', () => {
    expect(getHeaderLayout(390, 1)).toBe('full');
    expect(getInputToolbarLayout(1)).toBe('row');
    expect(getOperatingStateLayout(1)).toBe('row');
  });

  test('uses compact or stacked layouts before controls collide', () => {
    expect(getHeaderLayout(390, 1.3)).toBe('compact');
    expect(getInputToolbarLayout(1.3)).toBe('stack');
    expect(getOperatingStateLayout(1.3)).toBe('stack');
  });

  test('also compacts the header on narrow screens', () => {
    expect(getHeaderLayout(320, 1)).toBe('compact');
  });
});
