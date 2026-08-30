import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readSupportedLocales } from './i18n-supported-from-index.mjs';

/** Flatten nested locale trees to dotted paths → string values. */
export function flattenLocale(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenLocale(value, path, out);
    } else if (typeof value === 'string') {
      out[path] = value;
    } else {
      throw new Error(`Non-string leaf at ${path}`);
    }
  }
  return out;
}

function placeholderSignature(value, placeholderPattern) {
  if (typeof value !== 'string') {
    return '';
  }
  const re = new RegExp(placeholderPattern.source, placeholderPattern.flags.includes('g') ? placeholderPattern.flags : `${placeholderPattern.flags}g`);
  const matches = value.match(re);
  return matches ? [...matches].sort().join(',') : '';
}

/**
 * Validate every locale file against English using SUPPORTED_LOCALES from index.ts.
 *
 * @param {object} options
 * @param {string} options.appRoot App directory (contains src/i18n)
 * @param {string} [options.localesDir]
 * @param {string} [options.indexTsPath]
 * @param {RegExp} [options.placeholderPattern] Default: i18n-js %{var}
 * @param {(ctx: {
 *   fail: (message: string) => void,
 *   enFlat: Record<string, string>,
 *   localesDir: string,
 *   supported: string[],
 *   flatten: typeof flattenLocale,
 *   readLocale: (code: string) => Record<string, string>,
 * }) => void} [options.extraValidate]
 * @returns {{ ok: true, keyCount: number, localeCount: number } | { ok: false }}
 */
export function runFullLocaleParity(options) {
  const {
    appRoot,
    localesDir = join(appRoot, 'src/i18n/locales'),
    indexTsPath = join(appRoot, 'src/i18n/index.ts'),
    placeholderPattern = /%\{[^}]+\}/,
    extraValidate,
  } = options;

  let supported;
  try {
    supported = readSupportedLocales(indexTsPath);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return { ok: false };
  }

  const files = readdirSync(localesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
  if (files.join(',') !== [...supported].sort().join(',')) {
    console.error(`Locale files mismatch. Expected ${supported.join(',')}, found ${files.join(',')}`);
    return { ok: false };
  }

  const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'));
  const enFlat = flattenLocale(en);
  const enKeys = Object.keys(enFlat).sort();
  let failed = false;

  const fail = (message) => {
    console.error(message);
    failed = true;
  };

  const readLocale = (code) =>
    flattenLocale(JSON.parse(readFileSync(join(localesDir, `${code}.json`), 'utf8')));

  for (const code of supported) {
    if (code === 'en') continue;
    const flat = readLocale(code);
    const keys = Object.keys(flat).sort();
    const missing = enKeys.filter((k) => !(k in flat));
    const extra = keys.filter((k) => !(k in enFlat));
    const placeholderMismatches = enKeys.filter((key) => {
      const enValue = enFlat[key];
      const other = flat[key];
      if (typeof enValue !== 'string' || typeof other !== 'string') return false;
      return placeholderSignature(enValue, placeholderPattern) !== placeholderSignature(other, placeholderPattern);
    });
    if (missing.length) fail(`Missing in ${code}.json: ${missing.join(', ')}`);
    if (extra.length) fail(`Extra in ${code}.json: ${extra.join(', ')}`);
    if (placeholderMismatches.length) {
      fail(`Placeholder mismatch in ${code}.json: ${placeholderMismatches.join(', ')}`);
    }
  }

  const requiredLangLabels = Object.keys(enFlat)
    .filter((key) => key.startsWith('settings.language') && key !== 'settings.languageSystem')
    .sort();
  for (const key of requiredLangLabels) {
    if (!(key in enFlat)) {
      fail(`Missing language label in en.json: ${key}`);
    }
  }

  if (typeof extraValidate === 'function') {
    extraValidate({ fail, enFlat, localesDir, supported, flatten: flattenLocale, readLocale });
  }

  if (failed) {
    return { ok: false };
  }

  return { ok: true, keyCount: enKeys.length, localeCount: supported.length };
}
