import {cloudLlmService} from '../cloudLlmService';
import {connectivityService} from '../connectivityService';
import {demoLlmService} from '../demoLlmService';
import {llmService} from '../llmService';
import {modelConfig} from '../../config/loader';
import type {InferenceProvider, InferenceRunStats} from './types';

function llamaStats(): InferenceRunStats | null {
  const stats = llmService.getLastRunStats();
  if (stats.totalMs === null) return null;
  return {
    providerId: 'llama-rn',
    modelIdentity: modelConfig.filename,
    loadTimeMs: stats.loadMs ?? undefined,
    firstTokenTimeMs: stats.firstTokenMs ?? undefined,
    totalTimeMs: stats.totalMs,
    tokenCount: stats.tokenCount ?? undefined,
  };
}

function demoStats(): InferenceRunStats | null {
  const stats = demoLlmService.getLastRunStats();
  if (stats.totalMs === null) return null;
  return {
    providerId: 'demo',
    modelIdentity: 'document-formatter-v1',
    loadTimeMs: 0,
    firstTokenTimeMs: stats.firstTokenMs ?? undefined,
    totalTimeMs: stats.totalMs,
    tokenCount: stats.tokenCount ?? undefined,
  };
}

export const llamaProvider: InferenceProvider = {
  id: 'llama-rn',
  async getCapabilities() {
    return {
      providerId: 'llama-rn',
      state: llmService.isLoaded() ? 'available' : 'unavailable',
      locality: 'local',
      supportsStreaming: true,
      supportsCancellation: true,
      contextSize: modelConfig.contextSize ?? 4096,
      modelIdentity: modelConfig.filename,
      reason: llmService.isLoaded() ? undefined : 'model_not_ready',
    };
  },
  async generate(request) {
    const text = await llmService.generate(
      request.systemPrompt,
      request.userMessage,
      request.onToken,
    );
    return {
      text,
      providerId: 'llama-rn',
      modelIdentity: modelConfig.filename,
      locality: 'local',
      stats: llamaStats() ?? undefined,
    };
  },
  async cancel() {
    await llmService.stopGeneration();
  },
  getLastRunStats: llamaStats,
};

export const cloudProvider: InferenceProvider = {
  id: 'cloud',
  async getCapabilities() {
    const available = cloudLlmService.isAvailable() && connectivityService.isOnline();
    return {
      providerId: 'cloud',
      state: available ? 'available' : 'unavailable',
      locality: 'cloud',
      supportsStreaming: false,
      supportsCancellation: false,
      modelIdentity: 'operator-cloud-model',
      reason: available ? undefined : 'model_not_ready',
    };
  },
  async generate(request) {
    const started = Date.now();
    const text = await cloudLlmService.generate(
      request.systemPrompt,
      request.userMessage,
      request.onToken,
    );
    return {
      text,
      providerId: 'cloud',
      modelIdentity: 'operator-cloud-model',
      locality: 'cloud',
      stats: {
        providerId: 'cloud',
        modelIdentity: 'operator-cloud-model',
        totalTimeMs: Date.now() - started,
      },
    };
  },
  async cancel() {},
  getLastRunStats: () => null,
};

export const demoProvider: InferenceProvider = {
  id: 'demo',
  async getCapabilities() {
    return {
      providerId: 'demo',
      state: 'available',
      locality: 'local',
      supportsStreaming: true,
      supportsCancellation: false,
      modelIdentity: 'document-formatter-v1',
    };
  },
  async generate(request) {
    const text = await demoLlmService.generate(
      request.systemPrompt,
      request.userMessage,
      request.onToken,
    );
    return {
      text,
      providerId: 'demo',
      modelIdentity: 'document-formatter-v1',
      locality: 'local',
      stats: demoStats() ?? undefined,
    };
  },
  async cancel() {},
  getLastRunStats: demoStats,
};

export function createExistingProviders(): InferenceProvider[] {
  return [llamaProvider, cloudProvider, demoProvider];
}
