import type {InferenceCapabilities, InferenceProviderId, ProviderFailureReason} from './types';

export function providerDisplayName(providerId: InferenceProviderId): string {
  switch (providerId) {
    case 'apple-foundation-models':
      return 'Apple on-device model';
    case 'android-aicore':
      return 'Android system AI';
    case 'llama-rn':
      return 'Downloaded Airgap model';
    case 'cloud':
      return 'Cloud service';
    case 'demo':
      return 'Document answers';
  }
}

export function providerStateLabel(capabilities: InferenceCapabilities): string {
  switch (capabilities.state) {
    case 'available':
      return 'Ready';
    case 'downloadable':
      return 'Download needed';
    case 'downloading':
      return 'Downloading';
    case 'disabled':
      return 'Off';
    case 'unavailable':
      return capabilities.reason === 'model_not_ready' ? 'Not ready' : 'Unavailable';
  }
}

const REASON_DETAILS: Record<ProviderFailureReason, string> = {
  unsupported_device: 'This device does not support this provider.',
  unsupported_os: 'Update the operating system before using this provider.',
  unsupported_locale: 'This provider does not support the configured language.',
  provider_disabled: 'This provider is disabled by the operator configuration.',
  model_not_ready: 'The model is installed or configured but is not ready yet.',
  download_required: 'Download the model before using this provider.',
  busy: 'This provider is handling another request.',
  quota_exceeded: 'The device has temporarily limited requests from this app.',
  background_blocked: 'Keep the app open while this provider answers.',
  context_exceeded: 'The approved document context is too large for this provider.',
  generation_failed: 'This provider could not finish the last request.',
  cancelled: 'The last request was stopped.',
};

export function providerReasonDetail(capabilities: InferenceCapabilities): string {
  if (capabilities.reason) return REASON_DETAILS[capabilities.reason];
  if (capabilities.state === 'available') {
    return capabilities.locality === 'local'
      ? 'Answers are generated on this device.'
      : 'Answers use the operator-configured service.';
  }
  return 'Check readiness again or use the next configured provider.';
}

export function isSystemProvider(providerId: InferenceProviderId): boolean {
  return providerId === 'apple-foundation-models' || providerId === 'android-aicore';
}
