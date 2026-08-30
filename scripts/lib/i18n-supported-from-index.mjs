import { readFileSync } from 'node:fs';

/**
 * Parse `export const SUPPORTED_LOCALES = [...] as const` from src/i18n/index.ts.
 * Single source of truth for preflight i18n-parity scripts — avoids stale hardcoded lists.
 */
export function readSupportedLocales(indexTsPath) {
  let src;
  try {
    src = readFileSync(indexTsPath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read i18n index: ${indexTsPath} (${msg})`);
  }

  const match = src.match(/export const SUPPORTED_LOCALES\s*=\s*\[([^\]]+)\]\s*as const/);
  if (!match) {
    throw new Error(`Could not parse SUPPORTED_LOCALES in ${indexTsPath}`);
  }

  const codes = match[1]
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  if (codes.length === 0 || codes.some((code) => !/^[a-z]{2}$/.test(code))) {
    throw new Error(`Invalid SUPPORTED_LOCALES entries in ${indexTsPath}: ${codes.join(',')}`);
  }

  return codes;
}
