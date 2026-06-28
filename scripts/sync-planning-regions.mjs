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
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'planning/app-ideas/seacheck/regions');

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

async function main() {
  const packs = loadRegionPacksFromRepo(REPO_ROOT);
  if (packs.length === 0) {
    console.error('No packs parsed from regionPacks.ts — check parseRegionPacks.mjs');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const keep = new Set(packs.map((p) => `${p.id}.geojson`));
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith('.geojson') && !keep.has(file)) {
      await unlink(path.join(OUT_DIR, file));
      console.log(`removed stale ${file}`);
    }
  }

  for (const pack of packs) {
    const file = path.join(OUT_DIR, `${pack.id}.geojson`);
    await writeFile(file, `${JSON.stringify(packToGeojson(pack), null, 2)}\n`, 'utf8');
    console.log(`wrote ${pack.id}.geojson`);
  }

  const readme = `# Offline corridor pack boundaries

**Source of truth:** \`mobile/seacheck/src/map/regionPacks.ts\`

These GeoJSON files mirror the corridor packs in the app for planning and map tooling. Names and descriptions come from \`en.json\` via each pack's \`nameKey\` / \`descriptionKey\`.

Regenerate after changing packs in code:

\`\`\`bash
node mobile/seacheck/scripts/sync-planning-regions.mjs
\`\`\`

Legacy macro-region files (\`baltic-*.geojson\`) were removed when corridor packs replaced them.
`;
  await writeFile(path.join(OUT_DIR, 'README.md'), readme, 'utf8');
  console.log(`done (${packs.length} packs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
