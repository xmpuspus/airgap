// Only an explicit greeting gets the greeting reply. A short first question
// such as "fee" or "id" must reach the records.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

const GREETING = 'Hi there!';

describe('first-message greeting', () => {
  beforeEach(() => clearConversationHistory());

  it.each(['hi', 'hello', 'Hello!'])('greets "%s"', async text => {
    const response = await processMessage(text);

    expect(response.text).toContain(GREETING);
  });

  it.each(['fee', 'id'])('answers "%s" instead of greeting', async text => {
    const response = await processMessage(text);

    expect(response.text).not.toContain(GREETING);
  });
});
