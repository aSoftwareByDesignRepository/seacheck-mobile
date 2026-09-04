import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import da from '../locales/da.json';
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import itLocale from '../locales/it.json';
import nb from '../locales/nb.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import pt from '../locales/pt.json';
import sv from '../locales/sv.json';
import { SUPPORTED_LOCALES } from '../index';

const catalogs: Record<string, Record<string, unknown>> = {
  da: da as Record<string, unknown>,
  de: de as Record<string, unknown>,
  en: en as Record<string, unknown>,
  es: es as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  it: itLocale as Record<string, unknown>,
  nb: nb as Record<string, unknown>,
  nl: nl as Record<string, unknown>,
  pl: pl as Record<string, unknown>,
  pt: pt as Record<string, unknown>,
  sv: sv as Record<string, unknown>,
};

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function flattenValues(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenValues(v as Record<string, unknown>, path));
    } else if (typeof v === 'string') {
      out.push({ key: path, value: v });
    }
  }
  return out;
}

function collectStaticTranslationKeys(srcRoot: string): string[] {
  const keys = new Set<string>();
  const keyRe = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
  const stack = [srcRoot];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'locales' || entry.name === 'node_modules') continue;
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      const text = readFileSync(full, 'utf8');
      for (const match of text.matchAll(keyRe)) {
        keys.add(match[1]!);
      }
    }
  }
  return [...keys].sort();
}

describe('i18n locale parity', () => {
  it('covers the full Check-suite language family', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      ['da', 'de', 'en', 'es', 'fr', 'it', 'nb', 'nl', 'pl', 'pt', 'sv'].sort(),
    );
  });

  it('keeps every locale key tree identical to English', () => {
    const enKeys = flatten(catalogs.en).sort();
    for (const code of SUPPORTED_LOCALES) {
      if (code === 'en') continue;
      expect(flatten(catalogs[code]).sort()).toEqual(enKeys);
    }
  });

  it('keeps %{var} placeholders aligned with English in every locale', () => {
    const enFlat = flattenValues(catalogs.en);
    for (const code of SUPPORTED_LOCALES) {
      if (code === 'en') continue;
      const map = new Map(flattenValues(catalogs[code]).map((x) => [x.key, x.value]));
      for (const { key, value } of enFlat) {
        const translated = map.get(key);
        expect(translated).toBeDefined();
        const enVars = (value.match(/%\{(\w+)\}/g) || []).sort().join(',');
        const trVars = ((translated as string).match(/%\{(\w+)\}/g) || []).sort().join(',');
        expect({ code, key, trVars }).toEqual({ code, key, trVars: enVars });
      }
    }
  });

  it('locale JSON files exist on disk for every supported language', () => {
    const dir = join(__dirname, '../locales');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    expect(files).toEqual(
      ['da.json', 'de.json', 'en.json', 'es.json', 'fr.json', 'it.json', 'nb.json', 'nl.json', 'pl.json', 'pt.json', 'sv.json'],
    );
  });

  it('includes every static t("…") key used in src/ in the English catalog', () => {
    const enKeys = new Set(flatten(catalogs.en));
    const used = collectStaticTranslationKeys(join(__dirname, '../..'));
    const missing = used.filter((key) => !enKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('provides common.cancel for confirm dialogs in every locale', () => {
    for (const code of SUPPORTED_LOCALES) {
      const common = catalogs[code]?.common as Record<string, string> | undefined;
      expect(common?.cancel?.trim().length).toBeGreaterThan(0);
      expect(common?.dismiss?.trim().length).toBeGreaterThan(0);
    }
  });
});
