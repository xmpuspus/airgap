// LLM router. Picks demo / on-device / cloud based on config.llm.mode plus
// connectivity. Demo is operator-only (cannot be set via setUserMode); when
// the operator config says demo, it overrides any stale MMKV preference.

import {config} from '../config/loader';
import type {LlmSection} from '../config/loader';
import {llmService} from './llmService';
import {cloudLlmService} from './cloudLlmService';
import {demoLlmService} from './demoLlmService';
import {connectivityService} from './connectivityService';
import {logger} from './logger';
import {createMMKV} from 'react-native-mmkv';

export type Mode = 'offline-only' | 'prefer-online' | 'prefer-offline' | 'demo';
export type UserMode = Exclude<Mode, 'demo'>;

const VALID_MODES: ReadonlyArray<Mode> = [
  'offline-only',
  'prefer-online',
  'prefer-offline',
  'demo',
];

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (VALID_MODES as readonly string[]).includes(value);
}

function isUserMode(value: unknown): value is UserMode {
  return isMode(value) && value !== 'demo';
}

const userPrefs = createMMKV({id: 'user-prefs'});
const USER_LLM_MODE_KEY = 'user-llm-mode';

// Pure resolver. Exposed so tests can pump synthetic `llm` blocks through
// without swapping the module-level config singleton.
export function resolveConfigMode(llm: unknown): Mode {
  const block = (llm ?? {}) as {mode?: unknown};
  if (isMode(block.mode)) return block.mode;
  return 'prefer-offline';
}

export function getConfigMode(): Mode {
  return resolveConfigMode(config.llm as LlmSection | undefined);
}

export function getMode(): Mode {
  const configMode = getConfigMode();
  if (configMode === 'demo') return 'demo';
  const override = userPrefs.getString(USER_LLM_MODE_KEY);
  return isUserMode(override) ? override : configMode;
}

export function setUserMode(mode: UserMode | null): void {
  if (mode === null) {
    userPrefs.remove(USER_LLM_MODE_KEY);
    return;
  }
  if (isUserMode(mode)) {
    userPrefs.set(USER_LLM_MODE_KEY, mode);
  }
}

export interface LlmRouteResult {
  text: string;
  source: 'local' | 'cloud';
}

export function localAvailable(): boolean {
  return llmService.isLoaded();
}

export function cloudAvailable(): boolean {
  return cloudLlmService.isAvailable() && connectivityService.isOnline();
}

// Generate via the active mode. Throws only when no path is available.
export async function routeGeneration(
  systemPrompt: string,
  userMessage: string,
  onToken?: (token: string) => void,
): Promise<LlmRouteResult> {
  const mode = getMode();

  if (mode === 'demo') {
    const text = await demoLlmService.generate(systemPrompt, userMessage, onToken);
    return {text, source: 'local'};
  }

  const localOk = localAvailable();
  const cloudOk = cloudAvailable();

  const tryLocal = async (): Promise<LlmRouteResult> => {
    const text = await llmService.generate(systemPrompt, userMessage, onToken);
    return {text, source: 'local'};
  };
  const tryCloud = async (): Promise<LlmRouteResult> => {
    const text = await cloudLlmService.generate(systemPrompt, userMessage, onToken);
    return {text, source: 'cloud'};
  };

  if (mode === 'offline-only') {
    if (!localOk) throw new Error('local LLM not loaded and mode=offline-only');
    return tryLocal();
  }

  if (mode === 'prefer-online') {
    if (cloudOk) {
      try {
        return await tryCloud();
      } catch (err) {
        logger.warn('llmRouter', 'cloud failed, falling back to local', {
          err: String(err),
        });
      }
    }
    if (localOk) return tryLocal();
    throw new Error('no LLM available (prefer-online, both paths failed)');
  }

  // prefer-offline (default)
  if (localOk) {
    try {
      return await tryLocal();
    } catch (err) {
      logger.warn('llmRouter', 'local failed, escalating to cloud', {
        err: String(err),
      });
    }
  }
  if (cloudOk) {
    return tryCloud();
  }
  throw new Error('no LLM available (prefer-offline, local not loaded and cloud disabled)');
}
