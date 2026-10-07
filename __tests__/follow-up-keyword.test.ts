// A short question that matches a record keyword is a new topic, not a
// follow-up. Without this rule "Sino ka?" after a question about another
// country got that country's scope record instead of the identity record.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {matchesKnowledgeKeyword} from '../src/services/searchService';

describe('matchesKnowledgeKeyword', () => {
  it('matches a record keyword after case and punctuation are removed', () => {
    expect(matchesKnowledgeKeyword('Account security?')).toBe(true);
  });

  it('does not match a phrase that no record lists', () => {
    expect(matchesKnowledgeKeyword('tell me more')).toBe(false);
  });
});

describe('short keyword question after another topic', () => {
  beforeEach(() => clearConversationHistory());

  it('answers from the keyword record, not the previous topic', async () => {
    await processMessage('How do I activate roaming?');
    const response = await processMessage('account security');
    expect(response.text).toContain('Data privacy and account security');
    expect(response.text).not.toContain('Roaming activation and deactivation');
  });
});
