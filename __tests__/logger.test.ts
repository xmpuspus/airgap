import {logger, type LogEntry} from '../src/services/logger';

function logged(message: string): string {
  const entries: LogEntry[] = [];
  const remove = logger.addListener(entry => entries.push(entry));
  logger.info('test', message);
  remove();
  return entries[0].message;
}

// Built at runtime so no key-shaped literal sits in the source.
const keyBody = 'abcdefghijKLMNOPQRST1234';

describe('logger redaction', () => {
  test('removes an international phone number after a space', () => {
    expect(logged('call +639171234567 now')).toBe('call [phone] now');
  });

  test('removes an international phone number at the start of a message', () => {
    expect(logged('+639171234567 called')).toBe('[phone] called');
  });

  test('removes a bare secret key with the sk- prefix', () => {
    expect(logged(`using sk-${keyBody} today`)).toBe('using [token] today');
  });

  test('keeps a word that only ends in sk-', () => {
    expect(logged(`task-${keyBody} done`)).toBe(`task-${keyBody} done`);
  });
});
