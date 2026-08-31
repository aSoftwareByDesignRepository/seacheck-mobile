/**
 * Live GetMap probe — proves allowlisted depth WMS hosts return PNG bytes.
 * Uses Node https (not Jest/RN fetch polyfills) so CDN contract checks are real.
 * Uses a Web-Mercator tile-aligned bbox (z/x/y) so GeoWebCache accepts the request
 * the same way MapLibre’s raster source would. Not a MapLibre framebuffer screenshot.
 */
import https from 'node:https';
import { URL } from 'node:url';

import {
  DEPTH_GEBCO_LAYER_NAME,
  DEPTH_GEBCO_WMS_ENDPOINT,
  DEPTH_TRACKS_LAYER_NAME,
  DEPTH_TRACKS_WMS_ENDPOINT,
} from '../src/lib/settings/chartDepthOverlay';

/** Kiel-ish OSM tile z=8 x=135 y=81 — GWC-aligned resolution. */
const KIEL_TILE_BBOX_3857 =
  '1095801.2374962866,7200979.5606898852,1252344.2714243270,7357522.5946179256';

function getMapUrl(endpoint: string, layer: string): string {
  const params = [
    'SERVICE=WMS',
    'VERSION=1.1.1',
    'REQUEST=GetMap',
    `LAYERS=${encodeURIComponent(layer)}`,
    'STYLES=',
    'FORMAT=image%2Fpng',
    'TRANSPARENT=true',
    'SRS=EPSG%3A3857',
    'WIDTH=256',
    'HEIGHT=256',
    `BBOX=${KIEL_TILE_BBOX_3857}`,
  ].join('&');
  return `${endpoint}?${params}`;
}

function httpsGetPng(urlStr: string): Promise<{ status: number; ctype: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Accept: 'image/png,image/*;q=0.8,*/*;q=0.5',
          'User-Agent': 'SeaCheck-MomosProbe/0.1.3 (+https://software-by-design.de)',
        },
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            ctype: String(res.headers['content-type'] ?? '').toLowerCase(),
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`GetMap timeout for ${urlStr}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function assertPngGetMap(url: string): Promise<void> {
  const res = await httpsGetPng(url);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GetMap HTTP ${res.status} for ${url}\n${res.body.subarray(0, 200).toString('utf8')}`);
  }
  expect(res.ctype.includes('image/png') || res.ctype.includes('image/')).toBe(true);
  expect(res.body.byteLength).toBeGreaterThan(64);
  expect(res.body[0]).toBe(0x89);
  expect(res.body[1]).toBe(0x50);
  expect(res.body[2]).toBe(0x4e);
  expect(res.body[3]).toBe(0x47);
}

describe('depth WMS live GetMap contract', () => {
  jest.setTimeout(30_000);

  it('GEBCO GWC returns PNG for Kiel tile-aligned bbox', async () => {
    await assertPngGetMap(getMapUrl(DEPTH_GEBCO_WMS_ENDPOINT, DEPTH_GEBCO_LAYER_NAME));
  });

  it('OpenSeaMap track depths return PNG for Kiel tile-aligned bbox', async () => {
    await assertPngGetMap(getMapUrl(DEPTH_TRACKS_WMS_ENDPOINT, DEPTH_TRACKS_LAYER_NAME));
  });
});
