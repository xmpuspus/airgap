import {i18nConfig} from '../config/loader';

/**
 * Translate a UI string key. Returns the override from config.i18n.strings
 * if present, otherwise the English fallback.
 *
 * Usage: t('clearChat', 'Clear Conversation History')
 */
export function t(key: string, fallback: string): string {
  return i18nConfig.strings?.[key] ?? fallback;
}
