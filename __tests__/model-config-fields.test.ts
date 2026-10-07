// The model section sets how much of each record the model receives and how
// long one answer can take. Both used to be constants in code.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {config, modelConfig} from '../src/config/loader';
import {recordContextChars} from '../src/services/orchestrator';

describe('model record and time limits', () => {
  it('defaults to 400 characters per record and a 15 second limit', () => {
    expect(modelConfig.recordChars).toBe(400);
    expect(modelConfig.generationTimeoutMs).toBe(15000);
  });

  it('sends the whole record in demo mode and the configured cap otherwise', () => {
    expect(recordContextChars()).toBeNull();
    const llm = (config as unknown as {llm: {mode: string}}).llm;
    const model = modelConfig as {recordChars?: number};
    llm.mode = 'offline-only';
    model.recordChars = 1200;
    try {
      expect(recordContextChars()).toBe(1200);
    } finally {
      llm.mode = 'demo';
      model.recordChars = 400;
    }
  });
});
