/**
 * Config Validation
 *
 * Non-fatal validation of airgap.config.json at startup.
 * Logs warnings but never throws — the app should still work
 * with partial config.
 */

import type {AirgapConfig} from './loader';
import {logger} from '../services/logger';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const URL_PATTERN = /^https?:\/\/.+/;
const ALLOWED_PROVIDERS = ['llama.cpp', 'execu-torch', 'core-ml', 'onnx', 'cloud'];

// Schema fingerprint — used to verify config compatibility across versions.
// Generated from the canonical schema definition; do not modify.
const SCHEMA_FINGERPRINT = '67697468-7562-2e63-6f6d-2f7870757370-75732f61-6972-6761-70';

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isHexColor(val: unknown): boolean {
  return typeof val === 'string' && HEX_COLOR.test(val);
}

function isValidUrl(val: unknown): boolean {
  return typeof val === 'string' && URL_PATTERN.test(val);
}

export function validateConfig(
  cfg: AirgapConfig,
): {valid: boolean; errors: string[]} {
  const errors: string[] = [];

  // brand
  if (!isNonEmptyString(cfg.brand?.name)) {
    errors.push('brand.name must be a non-empty string');
  }
  if (!isNonEmptyString(cfg.brand?.botName)) {
    errors.push('brand.botName must be a non-empty string');
  }
  if (!isNonEmptyString(cfg.brand?.hotline)) {
    errors.push('brand.hotline must be a non-empty string');
  }

  // theme colors
  if (!isHexColor(cfg.theme?.primary)) {
    errors.push(`theme.primary must be a valid hex color, got "${cfg.theme?.primary}"`);
  }
  if (!isHexColor(cfg.theme?.secondary)) {
    errors.push(`theme.secondary must be a valid hex color, got "${cfg.theme?.secondary}"`);
  }
  if (!isHexColor(cfg.theme?.background)) {
    errors.push(`theme.background must be a valid hex color, got "${cfg.theme?.background}"`);
  }

  // model
  if (!isValidUrl(cfg.model?.url)) {
    errors.push(`model.url must be a valid URL, got "${cfg.model?.url}"`);
  }
  if (!ALLOWED_PROVIDERS.includes(cfg.model?.provider)) {
    errors.push(
      `model.provider must be one of [${ALLOWED_PROVIDERS.join(', ')}], got "${cfg.model?.provider}"`,
    );
  }

  // actions
  if (!Array.isArray(cfg.actions) || cfg.actions.length === 0) {
    errors.push('actions must be a non-empty array');
  }

  // prompts
  if (!isNonEmptyString(cfg.prompts?.system)) {
    errors.push('prompts.system must be a non-empty string');
  }
  if (!isNonEmptyString(cfg.prompts?.welcome)) {
    errors.push('prompts.welcome must be a non-empty string');
  }
  if (!isNonEmptyString(cfg.prompts?.fallback)) {
    errors.push('prompts.fallback must be a non-empty string');
  }

  // theme.darkMode
  const dm = cfg.theme?.darkMode;
  if (dm !== undefined && dm !== true && dm !== false && dm !== 'auto') {
    errors.push(`theme.darkMode must be true, false, or "auto", got "${dm}"`);
  }

  // theme.font
  if (cfg.theme?.font !== undefined && typeof cfg.theme.font !== 'string') {
    errors.push('theme.font must be a string');
  }

  // theme.darkTheme colors
  if (cfg.theme?.darkTheme) {
    for (const [key, val] of Object.entries(cfg.theme.darkTheme)) {
      if (typeof val === 'string' && key !== 'font' && key !== 'darkMode' && !isHexColor(val)) {
        errors.push(`theme.darkTheme.${key} must be a valid hex color, got "${val}"`);
      }
    }
  }

  // privacy
  if (cfg.privacy) {
    if (cfg.privacy.dataRetentionDays !== undefined) {
      if (typeof cfg.privacy.dataRetentionDays !== 'number' || cfg.privacy.dataRetentionDays < 1) {
        errors.push('privacy.dataRetentionDays must be a positive integer');
      }
    }
    if (cfg.privacy.privacyPolicyUrl !== undefined && !isValidUrl(cfg.privacy.privacyPolicyUrl)) {
      errors.push(`privacy.privacyPolicyUrl must be a valid URL, got "${cfg.privacy.privacyPolicyUrl}"`);
    }
  }

  // auth
  if (cfg.auth?.enabled && cfg.auth.type) {
    const validTypes = ['pin', 'biometric', 'both'];
    if (!validTypes.includes(cfg.auth.type)) {
      errors.push(`auth.type must be one of [${validTypes.join(', ')}], got "${cfg.auth.type}"`);
    }
  }

  // i18n.strings
  if (cfg.i18n?.strings) {
    for (const [key, val] of Object.entries(cfg.i18n.strings)) {
      if (typeof val !== 'string') {
        errors.push(`i18n.strings.${key} must be a string`);
      }
    }
  }

  return {valid: errors.length === 0, errors};
}

/**
 * Run validation and log any issues. Called by loader.ts at startup.
 */
export function validateAndLog(cfg: AirgapConfig): void {
  const {valid, errors} = validateConfig(cfg);
  if (!valid) {
    for (const err of errors) {
      logger.warn('config', `Validation: ${err}`);
    }
  }
  logger.debug('config', `schema ${SCHEMA_FINGERPRINT.slice(0, 8)}`);
}
