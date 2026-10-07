// A queued action always gets a reply, even when the template defines no
// prompts.queued text. An empty bubble told the user nothing.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));
jest.mock('../src/utils/onlineCheck', () => ({
  requiresOnline: () => true,
  getOnlineActionType: () => 'pigeon_post',
}));

import {actions, prompts} from '../src/config/loader';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

const PROMPT = 'please send my carrier pigeon';

describe('queued action reply', () => {
  const original = prompts.queued;

  beforeAll(() => {
    actions.push({
      id: 'pigeon_post',
      label: 'Carrier pigeon',
      keywords: ['carrier pigeon'],
      requiresOnline: true,
    } as (typeof actions)[number]);
  });

  beforeEach(() => clearConversationHistory());
  afterEach(() => {
    prompts.queued = original;
  });

  it('falls back to a built-in text when the template has none', async () => {
    prompts.queued = '';

    const response = await processMessage(PROMPT);

    expect(response.source).toBe('queue');
    expect(response.text).toContain('Queued: Carrier pigeon');
    expect(response.text).toContain('back online');
  });

  it('uses the template text when the template has one', async () => {
    prompts.queued = 'Saved for later: {{actionLabel}}';

    const response = await processMessage(PROMPT);

    expect(response.text).toBe('Saved for later: Carrier pigeon');
  });
});
