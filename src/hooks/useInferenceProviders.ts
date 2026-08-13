import {useCallback, useEffect, useRef, useState} from 'react';
import {Platform} from 'react-native';
import {config} from '../config/loader';
import {getInferenceProviders} from '../services/llmRouter';
import type {AndroidDownloadProgress} from '../services/inference/androidAicoreProvider';
import {
  readConfiguredProviderCapabilities,
  selectProviderEntriesForMode,
} from '../services/inference/providerReadiness';
import type {
  InferenceCapabilities,
  InferencePlatform,
  InferenceProvider,
  ProviderPolicyEntry,
} from '../services/inference/types';

interface DownloadableAndroidProvider extends InferenceProvider {
  download(
    requestId: string,
    onProgress?: (progress: AndroidDownloadProgress) => void,
  ): Promise<void>;
  warmup(): Promise<void>;
}

function canDownloadAndroid(provider: InferenceProvider): provider is DownloadableAndroidProvider {
  return (
    provider.id === 'android-aicore' &&
    'download' in provider &&
    typeof provider.download === 'function' &&
    'warmup' in provider &&
    typeof provider.warmup === 'function'
  );
}

function currentPlatform(): InferencePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function configuredEntries(providers: readonly InferenceProvider[]): ProviderPolicyEntry[] {
  return (
    config.llm?.providers ??
    providers.map((provider, priority) => ({
      id: provider.id,
      enabled: true,
      priority,
    }))
  );
}

export function useInferenceProviders() {
  const [providers, setProviders] = useState<InferenceCapabilities[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [downloadProgress, setDownloadProgress] = useState<number>();
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (mounted.current) {
      setLoading(true);
      setError(undefined);
    }
    const registered = getInferenceProviders();
    const capabilities = await readConfiguredProviderCapabilities(
      currentPlatform(),
      registered,
      selectProviderEntriesForMode(
        config.llm?.mode ?? 'prefer-offline',
        configuredEntries(registered),
      ),
    );
    if (mounted.current) {
      setProviders(capabilities);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh().catch(() => {
      if (mounted.current) {
        setLoading(false);
        setError('Provider status could not be refreshed.');
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const downloadSystemAi = useCallback(async () => {
    const policyEntry = config.llm?.providers?.find(entry => entry.id === 'android-aicore');
    if (policyEntry?.allowModelDownload !== true) {
      setError('System AI downloads are disabled by the operator configuration.');
      return;
    }
    const provider = getInferenceProviders().find(canDownloadAndroid);
    if (!provider) {
      setError('Android system AI is not available in this build.');
      return;
    }

    const requestId = `android-download-${Date.now()}`;
    setDownloadProgress(0);
    setProviders(current =>
      current.map(item =>
        item.providerId === 'android-aicore'
          ? {...item, state: 'downloading', reason: 'download_required'}
          : item,
      ),
    );
    try {
      await provider.download(requestId, progress => {
        if (!mounted.current || !progress.totalBytes || progress.totalBytes <= 0) return;
        setDownloadProgress(progress.bytesDownloaded / progress.totalBytes);
      });
      await provider.warmup();
      if (mounted.current) setDownloadProgress(1);
      await refresh();
    } catch {
      if (mounted.current) {
        setError('System AI could not be downloaded. Check device support and try again.');
        setDownloadProgress(undefined);
        setLoading(false);
      }
    }
  }, [refresh]);

  return {
    providers,
    loading,
    error,
    downloadProgress,
    refresh,
    downloadSystemAi,
  };
}
