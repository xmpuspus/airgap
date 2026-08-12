const mockContext = {
  completion: jest.fn(async () => ({text: 'Checked answer'})),
  stopCompletion: jest.fn(async () => undefined),
  release: jest.fn(async () => undefined),
};

jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async () => mockContext),
}));
jest.mock('../src/config/loader', () => ({
  modelConfig: {
    contextSize: 4096,
    gpuLayers: 0,
    threads: 2,
    maxTokens: 16,
    temperature: 0.2,
    topP: 0.9,
    stopTokens: ['</s>'],
  },
}));
jest.mock('../src/services/modelManager', () => ({
  modelManager: {getModelPath: () => '/tmp/model.gguf'},
}));

import {LLMService} from '../src/services/llmService';

describe('local LLM generation timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears the timeout after a completed generation', async () => {
    const service = new LLMService();
    await service.load();

    await expect(service.generate('System', 'Question')).resolves.toBe('Checked answer');

    expect(jest.getTimerCount()).toBe(0);
    expect(mockContext.stopCompletion).not.toHaveBeenCalled();
  });
});
