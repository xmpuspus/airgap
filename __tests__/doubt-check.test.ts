// "Are you sure?" returns the last record-backed answer again, with the same
// sources, from code. Consistency comes from the record store, not from a
// model's confidence, and the model is not asked a second time.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {isDoubtCheck} from '../src/utils/doubtCheck';

describe('isDoubtCheck', () => {
  it.each(['sigurado ka dyan?', 'Are you sure?', 'you sure?', 'really?', 'Talaga?', 'sure ba?'])(
    'matches %s',
    text => {
      expect(isDoubtCheck(text)).toBe(true);
    },
  );

  it.each(['Who is the current president?', 'How do I activate roaming?'])(
    'does not match %s',
    text => {
      expect(isDoubtCheck(text)).toBe(false);
    },
  );
});

describe('a doubt check after a record answer', () => {
  beforeEach(() => clearConversationHistory());

  it('repeats the same answer with the same sources', async () => {
    const first = await processMessage('How do I activate roaming?');
    expect(first.audit?.kbDocIds?.length).toBeGreaterThan(0);
    const second = await processMessage('sigurado ka dyan?');
    expect(second.text).toContain(first.text);
    expect(second.text).toMatch(/^Yes\./);
    expect(second.audit?.kbDocIds).toEqual(first.audit?.kbDocIds);
  });

  it('falls through to normal handling without an earlier record answer', async () => {
    const response = await processMessage('are you sure?');
    expect(response.text).not.toMatch(/^Yes\./);
  });
});
