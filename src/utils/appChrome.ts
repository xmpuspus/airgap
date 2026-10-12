// Copy and layout choices for the app frame around the chat. Pure functions,
// so each choice is unit tested without rendering.

// Without signed-bundle keys the app has no update server, so "Not synced"
// would read as a failure. The records in the app are the release.
export function recordsStatusLabel(syncConfigured: boolean, bandLabel: string): string {
  return syncConfigured ? bandLabel : 'Built-in records';
}

// A template that turns the offline queue off has nothing to put in Outbox.
export function showsOutbox(features: {offlineQueue?: boolean} | undefined): boolean {
  return features?.offlineQueue !== false;
}

export function howThisWorksDefaults(syncConfigured: boolean): string[] {
  return [
    'Encrypted conversations stay on this device',
    syncConfigured
      ? 'Downloads signed record updates when you are online'
      : 'Answers come from records stored in the app',
    'No question goes to a cloud service unless your organization turns one on',
  ];
}

// Decimal gigabytes everywhere, so the download card and the progress card agree.
export function formatModelSize(sizeBytes?: number): string {
  if (!sizeBytes) return 'size not set';
  return `${(sizeBytes / 1e9).toFixed(1)} GB`;
}

export function formatMegabytes(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

// The hotline comes from the template. A fixed number sent government users to
// the telco fixture's line.
export function chatErrorReply(hotline: string | undefined): string {
  return hotline
    ? `Sorry, something went wrong. Try again, or call ${hotline}.`
    : 'Sorry, something went wrong. Try again.';
}

// Android 15 draws apps edge to edge, so adjustResize no longer shrinks the
// window for the keyboard. Padding by the keyboard overlap works on both
// platforms, and the overlap is zero where the window still resizes.
export function chatKeyboardBehavior(_os: string): 'padding' {
  return 'padding';
}
