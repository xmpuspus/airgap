// Symptom phrases such as "no signal" describe a problem. They must not act as exclusions.
import {searchKB} from '../src/services/searchService';

describe('symptom queries against the telco knowledge base', () => {
  test.each([
    'no signal',
    'my phone is not working',
    'no internet',
    'no service here',
    'not loading',
  ])('"%s" puts troubleshooting records first', query => {
    const results = searchKB(query);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('troubleshooting');
  });

  test('"no signal" keeps the no-signal record', () => {
    expect(searchKB('no signal')[0].id).toBe('ts-no-signal');
  });

  test('"no internet" keeps more than one troubleshooting record', () => {
    const ids = searchKB('no internet').map(r => r.id);
    expect(ids).toEqual(expect.arrayContaining(['ts-wifi-fiber', 'ts-slow-data']));
  });

  test('an explicit exclusion still removes matching records', () => {
    const results = searchKB('no signal, not roaming');
    expect(results.every(r => !r.keywords.includes('roaming'))).toBe(true);
  });
});
