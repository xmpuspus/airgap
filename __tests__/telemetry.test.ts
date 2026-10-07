jest.mock('../src/config/loader', () => ({config: {analytics: {enabled: true}}}));
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());

import {getSecureStore} from '../src/services/secureStorage';
import {clearBuffer, recordTurn} from '../src/services/telemetry';
import {fnv1a32} from '../src/utils/hash';

describe('fnv1a32', () => {
  test.each([
    ['', '811c9dc5'],
    ['a', 'e40c292c'],
    ['foobar', 'bf9cf968'],
  ])('hashes "%s" to %s', (input, expected) => {
    expect(fnv1a32(input)).toBe(expected);
  });
});

describe('recordTurn', () => {
  beforeEach(() => clearBuffer());

  test('stores hashes of the query and answer, never the text', () => {
    recordTurn({
      query: 'how do I pay my bill',
      answer: 'Pay at any 7-Eleven.',
      retrievedDocIds: ['pay-1'],
      confidence: 0.9,
    });

    const raw = getSecureStore('telemetry-buffer').getString('pendingEvents') ?? '';
    const [event] = JSON.parse(raw);
    expect(event.query).toBe(`#${fnv1a32('how do I pay my bill')}`);
    expect(event.answerHash).toBe(`#${fnv1a32('Pay at any 7-Eleven.')}`);
    expect(event.query).toMatch(/^#[0-9a-f]{8}$/);
    expect(raw).not.toContain('pay my bill');
    expect(raw).not.toContain('7-Eleven');
  });
});
