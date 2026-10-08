import {decideNpm} from '../src/conflict-check';

const target = {name: 'create-airgap-bot', version: '0.2.0', owner: 'xmpuspus'};

describe('npm conflict decision', () => {
  test('an unpublished name is available', () => {
    expect(decideNpm(null, target).status).toBe('available');
  });

  test('a new version of our own package is available', () => {
    const body = {
      'dist-tags': {latest: '0.1.0'},
      versions: {'0.1.0': {}},
      maintainers: [{name: 'xmpuspus'}],
    };
    const result = decideNpm(body, target);
    expect(result.status).toBe('available');
    expect(result.detail).toContain('0.1.0');
  });

  test('a version that npm already has is taken', () => {
    const body = {
      'dist-tags': {latest: '0.2.0'},
      versions: {'0.1.0': {}, '0.2.0': {}},
      maintainers: [{name: 'xmpuspus'}],
    };
    expect(decideNpm(body, target).status).toBe('taken');
  });

  test('a name that another account owns is taken', () => {
    const body = {
      'dist-tags': {latest: '1.0.0'},
      versions: {'1.0.0': {}},
      maintainers: [{name: 'someone-else'}],
    };
    const result = decideNpm(body, target);
    expect(result.status).toBe('taken');
    expect(result.detail).toContain('someone-else');
  });
});
