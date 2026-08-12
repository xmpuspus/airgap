import {initLlama, LlamaContext} from 'llama.rn';
import {modelConfig} from '../config/loader';
import {modelManager} from './modelManager';
import {logger} from './logger';

export interface LlmRunStats {
  loadMs: number | null;
  firstTokenMs: number | null;
  totalMs: number | null;
  tokenCount: number | null;
}

export class LLMService {
  private context: LlamaContext | null = null;
  private loading = false;
  private generating = false;
  private lastLoadMs: number | null = null;
  private lastFirstTokenMs: number | null = null;
  private lastTotalMs: number | null = null;
  private lastTokenCount: number | null = null;

  isLoaded(): boolean {
    return this.context !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  isGenerating(): boolean {
    return this.generating;
  }

  /**
   * Returns timing stats from the most recent `load()` and `generate()` call.
   * All fields are null until those have run at least once. Consumed by the
   * benchmark harness in `src/dev/benchHarness.ts`.
   */
  getLastRunStats(): LlmRunStats {
    return {
      loadMs: this.lastLoadMs,
      firstTokenMs: this.lastFirstTokenMs,
      totalMs: this.lastTotalMs,
      tokenCount: this.lastTokenCount,
    };
  }

  async load(): Promise<void> {
    if (this.context || this.loading) return;

    this.loading = true;
    const startTime = Date.now();

    try {
      this.context = await initLlama({
        model: modelManager.getModelPath(),
        n_ctx: modelConfig.contextSize ?? 4096,
        n_gpu_layers: modelConfig.gpuLayers ?? 99,
        n_threads: modelConfig.threads ?? 4,
        use_mlock: false, // CRITICAL: true pins model in RAM, OOMs on 4GB devices
        use_mmap: true,
      });
      this.lastLoadMs = Date.now() - startTime;
      logger.info('LLM', `Model loaded in ${this.lastLoadMs}ms`);
    } catch (err) {
      logger.error('LLM', 'Model load failed', err);
      throw err;
    } finally {
      this.loading = false;
    }
  }

  async unload(): Promise<void> {
    if (!this.context) return;
    await this.context.release();
    this.context = null;
    logger.info('LLM', 'Model unloaded');
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    onToken?: (token: string) => void,
    onFirstToken?: () => void,
  ): Promise<string> {
    if (!this.context) {
      throw new Error('Model not loaded. Call load() first.');
    }

    // Concurrency guard — only one generation at a time
    if (this.generating) {
      logger.warn('LLM', 'Generation already in progress, skipping');
      throw new Error('Generation already in progress. Please wait.');
    }

    this.generating = true;
    const startTime = Date.now();
    // Reset stats for this run — keep loadMs (carries over from last load()).
    this.lastFirstTokenMs = null;
    this.lastTotalMs = null;
    this.lastTokenCount = 0;
    let firstTokenFired = false;

    // Generation timeout — prevent infinite hangs on slow devices
    const timeoutMs = 15_000; // Safety limit — not configurable
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        this.context?.stopCompletion();
        reject(new Error(`Generation timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });

    try {
      const resultPromise = this.context.completion(
        {
          messages: [
            {role: 'system', content: systemPrompt},
            {role: 'user', content: userMessage},
          ],
          n_predict: modelConfig.maxTokens ?? 256,
          temperature: modelConfig.temperature ?? 0.3,
          top_p: modelConfig.topP ?? 0.9,
          stop: modelConfig.stopTokens ?? ['<end_of_turn>', '<eos>', '</s>'],
        },
        data => {
          if (data.token) {
            if (!firstTokenFired) {
              firstTokenFired = true;
              this.lastFirstTokenMs = Date.now() - startTime;
              if (onFirstToken) {
                try {
                  onFirstToken();
                } catch (err) {
                  logger.warn('LLM', 'onFirstToken callback threw', {err: String(err)});
                }
              }
            }
            this.lastTokenCount = (this.lastTokenCount ?? 0) + 1;
            if (onToken) onToken(data.token);
          }
        },
      );

      const result = await Promise.race([resultPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      this.lastTotalMs = elapsed;
      logger.info('LLM', `Generated in ${elapsed}ms`, {
        tokens: result.text.split(/\s+/).length,
        elapsed,
      });

      return result.text;
    } catch (err) {
      logger.error('LLM', 'Generation failed', err);
      throw err;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.generating = false;
    }
  }

  async stopGeneration(): Promise<void> {
    if (!this.context) return;
    await this.context.stopCompletion();
    this.generating = false;
  }
}

export const llmService = new LLMService();
