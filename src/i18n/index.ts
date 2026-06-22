import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { PropsWithChildren, useEffect, useState } from 'react';

import de from './locales/de.json';
import en from './locales/en.json';

const STORAGE_KEY = 'seacheck.locale';

export type AppLocale = 'system' | 'de' | 'en';

export const i18n = new I18n({ en, de });

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

function resolveDeviceLocale(): string {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'de' ? 'de' : 'en';
}

export async function loadStoredLocale(): Promise<AppLocale> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === 'de' || raw === 'en' || raw === 'system') return raw;
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
