import {NativeModules} from 'react-native';

interface ProviderHarnessConstants {
  harnessScenario?: unknown;
}

function scenarioFrom(module: ProviderHarnessConstants | undefined): string | undefined {
  const value = module?.harnessScenario;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function activeProviderHarnessScenario(): string | undefined {
  if (!__DEV__) return undefined;
  return (
    scenarioFrom(NativeModules.AppleFoundationModelsModule as ProviderHarnessConstants) ??
    scenarioFrom(NativeModules.AndroidAicoreModule as ProviderHarnessConstants)
  );
}

export function providerHarnessActive(): boolean {
  return activeProviderHarnessScenario() !== undefined;
}
