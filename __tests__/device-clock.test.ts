// A date or time question gets the device clock as a system answer. A model
// has no clock, and a record only knows the date it was checked.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {formatDeviceClock, isClockQuestion} from '../src/utils/deviceClock';

describe('formatDeviceClock', () => {
  it('writes the full date, the time, and the zone in the configured language', () => {
    const text = formatDeviceClock(new Date('2026-10-07T08:30:00Z'), 'en', 'Asia/Manila');
    expect(text).toMatch(/Wednesday/);
    expect(text).toMatch(/October 7, 2026|7 October 2026/);
    expect(text).toMatch(/4:30/);
    expect(text).toContain('Asia/Manila');
  });
});

describe('isClockQuestion', () => {
  it.each([
    'What date and time now?',
    'what time is it',
    'Anong oras na?',
    'Ano ang petsa ngayon?',
    'What day is it today?',
  ])('matches %s', question => {
    expect(isClockQuestion(question)).toBe(true);
  });

  it.each(['How long does passport processing take?', 'Opening time of the DFA office'])(
    'does not match %s',
    question => {
      expect(isClockQuestion(question)).toBe(false);
    },
  );
});

describe('date and time questions in the orchestrator', () => {
  beforeEach(() => clearConversationHistory());

  it('answers from the device clock as a system message', async () => {
    const response = await processMessage('What date and time now?');
    expect(response.source).toBe('system');
    expect(response.text).toContain(String(new Date().getFullYear()));
    expect(response.text).toContain('clock');
  });
});
