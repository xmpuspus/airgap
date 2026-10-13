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
import {logger, type LogEntry} from '../src/services/logger';

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

  test('turns off the model thinking channel', async () => {
    const service = new LLMService();
    await service.load();
    await service.generate('System', 'Question');
    expect(mockContext.completion).toHaveBeenCalledWith(
      expect.objectContaining({enable_thinking: false}),
      expect.any(Function),
    );
  });

  test('logs the runtime token count, not a word count', async () => {
    mockContext.completion.mockImplementationOnce(async () => ({
      text: 'one two three',
      tokens_predicted: 9,
    }));
    const entries: LogEntry[] = [];
    const stop = logger.addListener(entry => entries.push(entry));
    const service = new LLMService();
    await service.load();

    await service.generate('System', 'Question');
    stop();

    const done = entries.find(entry => entry.message.startsWith('Generated in'));
    expect(done?.data).toMatchObject({tokens: 9});
  });

  test('rejects a second concurrent generation without a misleading skip log', async () => {
    mockContext.completion.mockImplementationOnce(() => new Promise(() => undefined));
    const entries: LogEntry[] = [];
    const stop = logger.addListener(entry => entries.push(entry));
    const service = new LLMService();
    await service.load();
    service.generate('System', 'first').catch(() => undefined);

    await expect(service.generate('System', 'second')).rejects.toThrow('already in progress');
    stop();

    expect(entries.filter(entry => entry.level === 'warn')).toEqual([]);
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
