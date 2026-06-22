import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

function getByPath(obj, dottedKey) {
  return dottedKey.split('.').reduce((current, part) => current?.[part], obj);
}

function placeholderSignature(value) {
  if (typeof value !== 'string') return '';
  const matches = value.match(/\{\{[^}]+\}\}/g);
  return matches ? [...matches].sort().join(',') : '';
}

const root = dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(readFileSync(join(root, '../src/i18n/locales/en.json'), 'utf8'));
const de = JSON.parse(readFileSync(join(root, '../src/i18n/locales/de.json'), 'utf8'));

const enKeys = flattenKeys(en);
const deKeys = flattenKeys(de);

const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
const placeholderMismatches = enKeys.filter((key) => {
  const enValue = getByPath(en, key);
  const deValue = getByPath(de, key);
  if (typeof enValue !== 'string' || typeof deValue !== 'string') return false;
  return placeholderSignature(enValue) !== placeholderSignature(deValue);
});

if (missingInDe.length || missingInEn.length || placeholderMismatches.length) {
  if (missingInDe.length) {
    console.error('Missing in de.json:', missingInDe.join(', '));
  }
  if (missingInEn.length) {
    console.error('Missing in en.json:', missingInEn.join(', '));
  }
  if (placeholderMismatches.length) {
    console.error('Placeholder mismatch:', placeholderMismatches.join(', '));
  }
  process.exit(1);
}

console.log(`PASS i18n parity (${enKeys.length} keys)`);
