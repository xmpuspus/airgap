// A model has no clock. A record only knows the date it was checked. The
// device clock is the one honest source for "what time is it", so the
// orchestrator answers that question here, before retrieval and before any model.

const CLOCK_PATTERNS = [
  /\b(what|which)\s+(time|date|day)\b/i,
  /\b(time|date)\s+(now|today|right now)\b/i,
  /\bdate and time\b/i,
  /\b(anong|ano ang|ano'ng)\s+(oras|petsa|araw)\b/i,
];

export function isClockQuestion(text: string): boolean {
  return CLOCK_PATTERNS.some(pattern => pattern.test(text));
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function formatDeviceClock(
  now: Date = new Date(),
  language = 'en',
  timeZone: string = deviceTimeZone(),
): string {
  const formatter = new Intl.DateTimeFormat(language, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  });
  return `${formatter.format(now)} (${timeZone})`;
}
