type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

type LogListener = (entry: LogEntry) => void;

/**
 * Patterns that scrub values that look like secrets or PII. Keep the list
 * tight — false positives turn the logger into a debugging obstacle.
 */
const REDACT_PATTERNS: {name: string; re: RegExp; replacement: string}[] = [
  {name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: '[email]'},
  {name: 'phonePH', re: /\b09\d{9}\b/g, replacement: '[phone]'},
  {name: 'phoneIntl', re: /\b\+\d{7,15}\b/g, replacement: '[phone]'},
  {name: 'creditCard', re: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[card]'},
  {name: 'bearerToken', re: /(?:Bearer|token|sk-|api_key)[=:\s]+[A-Za-z0-9_-]{16,}/gi, replacement: '[token]'},
];

function redact(value: string): string {
  let out = value;
  for (const p of REDACT_PATTERNS) {
    out = out.replace(p.re, p.replacement);
  }
  return out;
}

function redactDeep(input: unknown): unknown {
  if (typeof input === 'string') return redact(input);
  if (Array.isArray(input)) return input.map(redactDeep);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = redactDeep(v);
    }
    return out;
  }
  return input;
}

class Logger {
  private enabled = __DEV__;
  private listeners: LogListener[] = [];
  private redactEnabled = true;

  private emit(level: LogLevel, module: string, message: string, data?: unknown) {
    const safeMessage = this.redactEnabled ? redact(message) : message;
    const safeData = this.redactEnabled ? redactDeep(data) : data;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message: safeMessage,
      data: safeData,
    };

    if (this.enabled) {
      const prefix = `[${entry.timestamp.substring(11, 19)}] [${level.toUpperCase()}] [${module}]`;
      if (level === 'error') console.error(prefix, safeMessage, safeData ?? '');
      else if (level === 'warn') console.warn(prefix, safeMessage, safeData ?? '');
      else console.log(prefix, safeMessage, safeData ?? '');
    }

    this.listeners.forEach(fn => fn(entry));
  }

  setRedactionEnabled(v: boolean) {
    this.redactEnabled = v;
  }

  debug(module: string, message: string, data?: unknown) {
    this.emit('debug', module, message, data);
  }

  info(module: string, message: string, data?: unknown) {
    this.emit('info', module, message, data);
  }

  warn(module: string, message: string, data?: unknown) {
    this.emit('warn', module, message, data);
  }

  error(module: string, message: string, data?: unknown) {
    this.emit('error', module, message, data);
  }

  addListener(fn: LogListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const logger = new Logger();
export type {LogEntry, LogLevel};
