/* eslint-disable no-bitwise -- FNV-1a hash uses ^=, >>>, etc. as
 * intended bit operations, not as && / || typos. */
/**
 * Cloud LLM proxy — routes LLM requests through the BFF when the config
 * enables hybrid mode and the device is online.
 *
 * Contract:
 *   - Same generate(systemPrompt, userMessage, onToken?) signature as
 *     llmService, so the orchestrator can swap based on config.llm.mode.
 *   - Responses are cached by (query_hash, kbVersion) for the session to
 *     avoid double-billing repeated queries.
 *   - Every cloud call is recorded in telemetry under the toolCalls field
 *     as 'cloud_llm' so the dev panel counts it separately from local.
 *   - Network/auth errors never crash the app; callers fall back to the
 *     local llmService per config.llm.mode.
 *
 * The BFF is expected to expose:
 *
 *   POST /api/v1/llm/generate
 *     body: { system, user, maxTokens, temperature }
 *     response: { text, model, latencyMs }
 *
 * Production operators should authenticate this endpoint with whatever
 * their infrastructure already uses (mTLS, IAP, shared-secret, whatever).
 */

import {config} from '../config/loader';
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

// FNV-1a 32-bit hash. Bitwise operators are intentional here.
function hashKey(system: string, user: string, kbVersion: string): string {
  const base = `${kbVersion}::${system}::${user}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.text;
}

function cacheSet(key: string, text: string): void {
  cache.set(key, {text, expiresAt: Date.now() + CACHE_TTL_MS});
  // Crude LRU — cap size at 100 entries
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

export class CloudLLMService {
  private generating = false;

  isAvailable(): boolean {
    const llm = (config as any).llm;
    const backend = (config as any).backend;
    return !!(llm?.cloud?.enabled && (llm?.cloud?.endpoint || backend?.baseUrl));
  }

  private getEndpoint(): string | null {
    const llm = (config as any).llm;
    if (llm?.cloud?.endpoint) return llm.cloud.endpoint;
    const backend = (config as any).backend;
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

    const llm = (config as any).llm ?? {};
    const kbVersion = llm.cacheByKbVersion ? getCurrentKbVersion() : 'na';
    const cacheKey = hashKey(systemPrompt, userMessage, kbVersion);
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('cloudLlm', 'cache hit');
      if (onToken) onToken(hit);
      return hit;
    }

    this.generating = true;
    const started = Date.now();
    try {
      const endpoint = this.getEndpoint()!;
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

// Deferred import to break the cycle with syncService which imports from here.
function getCurrentKbVersion(): string {
  try {
    const {getStalenessInfo} = require('./syncService') as typeof import('./syncService');
    return getStalenessInfo().kbVersion ?? 'na';
  } catch {
    return 'na';
  }
}

export const cloudLlmService = new CloudLLMService();
