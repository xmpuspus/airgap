/**
 * Cloud LLM proxy. Sends LLM requests through the BFF when the config
 * enables the cloud provider and the device is online.
 *
 * Contract:
 *   - Same generate(systemPrompt, userMessage, onToken?) signature as
 *     llmService. The `cloudProvider` in inference/existingProviders.ts
 *     wraps this service.
 *   - Responses are cached by (system prompt, user message, kbVersion) for
 *     the session to avoid double-billing repeated queries.
 *   - Network and auth errors reject the promise. The provider resolver in
 *     inference/providerResolver.ts handles fallback to the next provider.
 *
 * The BFF is expected to expose:
 *
 *   POST /api/v1/llm/generate
 *     body: { system, user, maxTokens, temperature }
 *     response: { text, model, latencyMs }
 *
 * Production operators must use their identity, authorization, retention,
 * and audit controls at this endpoint.
 */

import {config} from '../config/loader';
import type {LlmSection} from '../config/loader';
import {logger} from './logger';
import {connectivityService} from './connectivityService';
import {getAccessToken} from './authProvider';

interface CloudGenerateResponse {
  text: string;
  model?: string;
  latencyMs?: number;
}

const cache = new Map<string, {text: string; expiresAt: number}>();
const CACHE_TTL_MS = 30 * 60 * 1000;

// The full string is the key: a short hash can collide and serve another answer.
function cacheKeyFor(system: string, user: string, kbVersion: string): string {
  return `${kbVersion}::${system}::${user}`;
}

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // Re-insert so Map order tracks recent use and eviction drops the least recent.
  cache.delete(key);
  cache.set(key, entry);
  return entry.text;
}

function cacheSet(key: string, text: string): void {
  cache.delete(key);
  cache.set(key, {text, expiresAt: Date.now() + CACHE_TTL_MS});
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

export class CloudLLMService {
  private generating = false;

  isAvailable(): boolean {
    const llm: LlmSection | undefined = config.llm;
    const backend = config.backend;
    return !!(llm?.cloud?.enabled && (llm?.cloud?.endpoint || backend?.baseUrl));
  }

  private getEndpoint(): string | null {
    const llm: LlmSection | undefined = config.llm;
    if (llm?.cloud?.endpoint) return llm.cloud.endpoint;
    const backend = config.backend;
    if (backend?.baseUrl) {
      return `${backend.baseUrl.replace(/\/+$/, '')}/api/v1/llm/generate`;
    }
    return null;
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('cloud LLM not configured');
    }
    if (!connectivityService.isOnline()) {
      throw new Error('offline');
    }
    if (this.generating) {
      throw new Error('cloud generation already in progress');
    }

    const llm: LlmSection = config.llm ?? {};
    const kbVersion = llm.cacheByKbVersion ? getCurrentKbVersion() : 'na';
    const cacheKey = cacheKeyFor(systemPrompt, userMessage, kbVersion);
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('cloudLlm', 'cache hit');
      if (onToken) onToken(hit);
      return hit;
    }

    this.generating = true;
    const started = Date.now();
    try {
      const endpoint = this.getEndpoint();
      if (!endpoint) throw new Error('cloud LLM not configured');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = await getAccessToken(llm.cloud?.audience ?? 'airgap-cloud');
      headers.Authorization = `Bearer ${token}`;
      const body = JSON.stringify({
        system: systemPrompt,
        user: userMessage,
        maxTokens: llm.cloud?.maxTokens ?? 512,
        temperature: llm.cloud?.temperature ?? 0.3,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        throw new Error(`cloud LLM HTTP ${res.status}`);
      }
      const parsed = (await res.json()) as CloudGenerateResponse;
      const text = parsed.text ?? '';
      cacheSet(cacheKey, text);
      logger.info('cloudLlm', 'cloud generation complete', {
        latencyMs: parsed.latencyMs ?? Date.now() - started,
        model: parsed.model,
      });
      if (onToken) onToken(text);
      return text;
    } finally {
      this.generating = false;
    }
  }
}

// Loaded on first use, so loading this module does not also load the sync
// store, the knowledge index, and native storage.
function getCurrentKbVersion(): string {
  try {
    const {getStalenessInfo} = require('./syncService') as typeof import('./syncService');
    return getStalenessInfo().kbVersion ?? 'na';
  } catch {
    return 'na';
  }
}

export const cloudLlmService = new CloudLLMService();
