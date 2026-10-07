// Demo mode renders the retrieved record as the answer, so it must show the
// whole record. The 400-character cap exists for small model contexts only, and
// it used to cut the source line off every demo answer.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {clearConversationHistory, processMessage} from '../src/services/orchestrator';
import {searchKB} from '../src/services/searchService';
import {buildUserMessage, MODEL_CONTEXT_CHARS} from '../src/utils/promptBuilder';
import type {KBDocument} from '../src/types/knowledge';

const longDoc: KBDocument = {
  id: 'long-1',
  category: 'faq',
  title: 'A long record',
  content: `${'word '.repeat(120)}Source: https://example.gov.ph/page (checked 2026-10-07).`,
  keywords: [],
  tags: [],
  metadata: {},
};

describe('buildUserMessage record cap', () => {
  it('cuts each record at the model cap by default', () => {
    const message = buildUserMessage('q', [longDoc]);
    expect(message).not.toContain('checked 2026-10-07');
    expect(message).toContain(longDoc.content.substring(0, MODEL_CONTEXT_CHARS));
  });

  it('sends the whole record when the cap is null', () => {
    const message = buildUserMessage('q', [longDoc], undefined, {contextChars: null});
    expect(message).toContain('Source: https://example.gov.ph/page (checked 2026-10-07).');
  });

  it('tells the model not to mention the reference block', () => {
    const message = buildUserMessage('Who is the secretary?', [longDoc]);
    const instruction = message.split('\n\n').at(-1) ?? '';
    expect(instruction).toContain('Do not mention the reference information');
    expect(instruction).not.toMatch(/^Based ONLY on/);
    expect(instruction.endsWith('Who is the secretary?')).toBe(true);
  });
});

describe('demo answers show the whole record', () => {
  beforeEach(() => clearConversationHistory());

  it('keeps the end of a record longer than the model cap', async () => {
    const query = 'Slow mobile data or internet';
    const long = searchKB(query).find(doc => doc.content.length > MODEL_CONTEXT_CHARS);
    expect(long).toBeDefined();
    const response = await processMessage(query);
    expect(response.text).toContain((long as KBDocument).content.trim().slice(-40));
  });
});
