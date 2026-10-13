// A first message of thanks or goodbye gets a matching reply, not a hello.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

describe('first-message thanks and goodbye', () => {
  beforeEach(() => clearConversationHistory());

  it.each(['thanks', 'Thank you!'])('thanks "%s" instead of greeting', async text => {
    const response = await processMessage(text);

    expect(response.source).toBe('system');
    expect(response.text).not.toContain('Hi there!');
    expect(response.text).toContain('You are welcome');
  });

  it.each(['bye', 'Goodbye.'])('says goodbye to "%s" instead of greeting', async text => {
    const response = await processMessage(text);

    expect(response.source).toBe('system');
    expect(response.text).not.toContain('Hi there!');
    expect(response.text).toContain('Goodbye');
  });
});
