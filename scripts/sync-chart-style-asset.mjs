#!/usr/bin/env node
/**
 * Keep android/app/src/main/assets/map/chart-style.json in lockstep with
 * src/map/chartStyle.ts buildChartStyleSpec(). Android OfflineManager loopback
 * server serves this bundled asset. The /android tree is gitignored — regenerate
 * after prebuild/clean before unit tests or release builds.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'android/app/src/main/assets/map/chart-style.json');

const CHART_BASE_TILE_URLS = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
const SEAMARK_TILE_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

const spec = {
  version: 8,
  name: 'SeaCheck Chart',
  sources: {
    'osm-base': {
      type: 'raster',
      tiles: [...CHART_BASE_TILE_URLS],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    'openseamap-seamarks': {
      type: 'raster',
      tiles: [SEAMARK_TILE_URL],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© OpenSeaMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#aad3df' } },
    { id: 'osm-base-layer', type: 'raster', source: 'osm-base' },
    {
      id: 'openseamap-seamarks-layer',
      type: 'raster',
      source: 'openseamap-seamarks',
      paint: { 'raster-opacity': 1 },
    },
  ],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`sync-chart-style-asset: wrote ${path.relative(root, out)}`);
