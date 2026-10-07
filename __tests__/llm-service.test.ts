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

import {modelConfig} from '../src/config/loader';
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

  test('stops a generation at the configured time limit', async () => {
    const model = modelConfig as {generationTimeoutMs?: number};
    model.generationTimeoutMs = 5000;
    mockContext.completion.mockImplementationOnce(() => new Promise(() => undefined));
    const service = new LLMService();
    await service.load();
    try {
      const pending = service.generate('System', 'Question');
      jest.advanceTimersByTime(5000);
      await expect(pending).rejects.toThrow('timed out after 5s');
      expect(mockContext.stopCompletion).toHaveBeenCalled();
    } finally {
      delete model.generationTimeoutMs;
    }
  });
});
