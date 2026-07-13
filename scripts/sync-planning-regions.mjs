#!/usr/bin/env node
/**
 * Sync planning/app-ideas/seacheck/regions/*.geojson from mobile corridor pack definitions.
 * Source of truth: mobile/seacheck/src/map/regionPacks.ts
 *
 *   node mobile/seacheck/scripts/sync-planning-regions.mjs
 */
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegionPacksFromRepo } from './lib/parseRegionPacks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEACHECK_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES_DIR = path.join(SEACHECK_ROOT, 'fixtures/region-geojson');
const PLANNING_DIR = path.join(REPO_ROOT, 'planning/app-ideas/seacheck/regions');

function boundsToPolygon([west, south, east, north]) {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function packToGeojson(pack) {
  return {
    type: 'Feature',
    properties: {
      id: pack.id,
      name: pack.name,
      nameKey: pack.nameKey,
      descriptionKey: pack.descriptionKey,
      priority: pack.priority,
      description: pack.description,
      zoomDefault: { min: pack.minZoom, max: pack.maxZoom },
      layers: ['base', 'seamarks'],
    },
    geometry: {
      type: 'Polygon',
      coordinates: [boundsToPolygon(pack.bounds)],
    },
  };
}

async function writePackGeojson(outDir, packs) {
  await mkdir(outDir, { recursive: true });

  const keep = new Set(packs.map((p) => `${p.id}.geojson`));
  for (const file of await readdir(outDir)) {
    if (file.endsWith('.geojson') && !keep.has(file)) {
      await unlink(path.join(outDir, file));
      console.log(`removed stale ${file}`);
    }
  }

  for (const pack of packs) {
    const file = path.join(outDir, `${pack.id}.geojson`);
    await writeFile(file, `${JSON.stringify(packToGeojson(pack), null, 2)}\n`, 'utf8');
    console.log(`wrote ${path.relative(SEACHECK_ROOT, file)}`);
  }
}

async function main() {
  const repoRoots = [REPO_ROOT, SEACHECK_ROOT];
  let packs = [];
  for (const root of repoRoots) {
    try {
      packs = loadRegionPacksFromRepo(root);
      if (packs.length > 0) break;
    } catch {
      /* try next layout */
    }
  }
  if (packs.length === 0) {
    console.error('No packs parsed from regionPacks.ts — check parseRegionPacks.mjs');
    process.exit(1);
  }

  await writePackGeojson(FIXTURES_DIR, packs);

  try {
    await writePackGeojson(PLANNING_DIR, packs);
    const readme = `# Offline corridor pack boundaries

**Source of truth:** \`mobile/seacheck/src/map/regionPacks.ts\`

These GeoJSON files mirror the corridor packs in the app for planning and map tooling. Names and descriptions come from \`en.json\` via each pack's \`nameKey\` / \`descriptionKey\`.

Regenerate after changing packs in code:

\`\`\`bash
npm run sync:regions
\`\`\`

Legacy macro-region files (\`baltic-*.geojson\`) were removed when corridor packs replaced them.
`;
    await writeFile(path.join(PLANNING_DIR, 'README.md'), readme, 'utf8');
  } catch (err) {
    console.warn(`skipped planning export (${PLANNING_DIR}): ${err instanceof Error ? err.message : err}`);
  }

  console.log(`done (${packs.length} packs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
