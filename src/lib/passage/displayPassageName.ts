import { SUPPORTED_LOCALES, i18n, t } from '../../i18n';

let cachedDefaultNames: Set<string> | null = null;

/**
 * Default passage titles across all shipped locales.
 * Stored names often freeze the locale that created them (EN bleed on DE).
 */
function defaultPassageNames(): Set<string> {
  if (cachedDefaultNames) return cachedDefaultNames;
  const names = new Set<string>();
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = i18n.translations[locale] as { passage?: { defaultName?: string } } | undefined;
    const name = catalog?.passage?.defaultName;
    if (typeof name === 'string' && name.trim()) {
      names.add(name.trim());
    }
  }
  cachedDefaultNames = names;
  return names;
}

/** Show the current-locale default when the stored name is any locale's stock title. */
export function displayPassageName(storedName: string | null | undefined): string {
  const trimmed = storedName?.trim() ?? '';
  if (!trimmed || defaultPassageNames().has(trimmed)) {
    return t('passage.defaultName');
  }
  return trimmed;
}
