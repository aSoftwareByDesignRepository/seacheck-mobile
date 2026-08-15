import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { PropsWithChildren, useEffect, useState } from 'react';

import da from './locales/da.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import nb from './locales/nb.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import sv from './locales/sv.json';

const STORAGE_KEY = 'seacheck.locale';

export const SUPPORTED_LOCALES = ['da', 'de', 'en', 'es', 'fr', 'it', 'nb', 'nl', 'pl', 'pt', 'sv'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type AppLocale = 'system' | SupportedLocale;

export const i18n = new I18n({ en, de, fr, es, da, nl, it, pl, sv, nb, pt });

const localeListeners = new Set<() => void>();

function notifyLocaleChange() {
  localeListeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [, setRevision] = useState(0);
  useEffect(() => subscribeLocaleChange(() => setRevision((n) => n + 1)), []);
  return children;
}

let initialized = false;

export function initI18n() {
  if (initialized) return;
  i18n.enableFallback = true;
  i18n.defaultLocale = 'en';
  i18n.locale = resolveDeviceLocale();
  initialized = true;
}

function isSupportedLocale(code: string): code is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

function resolveDeviceLocale(): string {
  const code = getLocales()[0]?.languageCode ?? 'en';
  if (code === 'nb' || code === 'no') {
    return 'nb';
  }
  if (isSupportedLocale(code)) {
    return code;
  }
  return 'en';
}

export async function loadStoredLocale(): Promise<AppLocale> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === 'system' || (raw != null && isSupportedLocale(raw))) {
    return raw;
  }
  return 'system';
}

export async function applyLocalePreference(pref: AppLocale) {
  i18n.locale = pref === 'system' ? resolveDeviceLocale() : pref;
  await AsyncStorage.setItem(STORAGE_KEY, pref);
  notifyLocaleChange();
}

export function subscribeLocaleChange(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export function getIntlLocale(): string {
  switch (i18n.locale) {
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'da':
      return 'da-DK';
    case 'nl':
      return 'nl-NL';
    case 'it':
      return 'it-IT';
    case 'pl':
      return 'pl-PL';
    case 'sv':
      return 'sv-SE';
    case 'nb':
      return 'nb-NO';
    case 'pt':
      return 'pt-BR';
    default:
      return 'en-GB';
  }
}

export function localePreferenceLabel(pref: AppLocale): string {
  switch (pref) {
    case 'system':
      return 'System';
    case 'de':
      return 'Deutsch';
    case 'en':
      return 'English';
    case 'fr':
      return 'Français';
    case 'es':
      return 'Español';
    case 'da':
      return 'Dansk';
    case 'nl':
      return 'Nederlands';
    case 'it':
      return 'Italiano';
    case 'pl':
      return 'Polski';
    case 'sv':
      return 'Svenska';
    case 'nb':
      return 'Norsk';
    case 'pt':
      return 'Português';
    default:
      return 'System';
  }
}
