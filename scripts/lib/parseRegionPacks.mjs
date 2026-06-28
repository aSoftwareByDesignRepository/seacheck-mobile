import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Resolve dotted i18n key against nested JSON (e.g. downloads.packs.kielBay.name). */
export function resolveI18nKey(messages, key) {
  const parts = key.split('.');
  let cur = messages;
  for (const part of parts) {
    cur = cur?.[part];
  }
  return typeof cur === 'string' ? cur : key;
}

/** Parse REGION_PACKS from regionPacks.ts without a TypeScript compiler. */
export function parseRegionPacksFromTs(tsContent) {
  const packs = [];
  const blockRe =
    /{\s*id:\s*'([^']+)',\s*nameKey:\s*'([^']+)',\s*descriptionKey:\s*'([^']+)',\s*bounds:\s*\[([^\]]+)\],\s*minZoom:\s*(\d+),\s*maxZoom:\s*(\d+),\s*layers:\s*\[[^\]]+\],\s*priority:\s*'(P[012])',/g;
  let match;
  while ((match = blockRe.exec(tsContent)) !== null) {
    const [, id, nameKey, descriptionKey, boundsRaw, minZoom, maxZoom, priority] = match;
    const bounds = boundsRaw.split(',').map((n) => Number.parseFloat(n.trim()));
    if (bounds.length !== 4 || bounds.some((n) => !Number.isFinite(n))) continue;
    packs.push({
      id,
      nameKey,
      descriptionKey,
      bounds,
      minZoom: Number(minZoom),
      maxZoom: Number(maxZoom),
      priority,
    });
  }
  return packs;
}

export function loadRegionPacksFromRepo(repoRoot) {
  const tsPath = path.join(repoRoot, 'mobile/seacheck/src/map/regionPacks.ts');
  const enPath = path.join(repoRoot, 'mobile/seacheck/src/i18n/locales/en.json');
  const tsContent = readFileSync(tsPath, 'utf8');
  const en = JSON.parse(readFileSync(enPath, 'utf8'));
  return parseRegionPacksFromTs(tsContent).map((pack) => ({
    ...pack,
    name: resolveI18nKey(en, pack.nameKey),
    description: resolveI18nKey(en, pack.descriptionKey),
  }));
}
