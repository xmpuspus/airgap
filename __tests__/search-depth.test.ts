// The orchestrator must honor knowledge.search.topK, so a template can keep each
// answer to one record instead of the three the orchestrator once hardcoded.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {config} from '../src/config/loader';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

describe('search depth follows the configuration', () => {
  const search = config.knowledge.search as {topK?: number};
  const original = search.topK;

  beforeEach(() => clearConversationHistory());
  afterEach(() => {
    search.topK = original;
  });

  it('returns one record when topK is 1', async () => {
    search.topK = 1;
    const response = await processMessage('What prepaid plans do you have?');
    expect(response.audit?.kbDocIds).toHaveLength(1);
  });

  it('returns three records with the default depth', async () => {
    const response = await processMessage('What prepaid plans do you have?');
    expect(response.audit?.kbDocIds).toHaveLength(3);
  });
});
