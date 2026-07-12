import type { Feature, FeatureCollection } from 'geojson';

import {
  boundsFromPoints,
  CUSTOM_DOWNLOAD_CORNER_COUNT,
  type DownloadCorner,
} from './customDownloadCorners';

/** High-contrast palette — readable on water (#b8d4e8) and land tiles. */
export const CUSTOM_DOWNLOAD_OVERLAY_COLORS = {
  corner: '#c62828',
  cornerSelected: '#8b0000',
  cornerStroke: '#ffffff',
  fill: '#e65100',
  line: '#c62828',
  previewFill: '#e65100',
  previewLine: '#bf360c',
} as const;

export function buildCustomDownloadOverlayGeoJson(params: {
  corners: DownloadCorner[];
  showEdgePreview: boolean;
}): FeatureCollection {
  const { corners, showEdgePreview } = params;
  const features: Feature[] = [];

  const previewBounds =
    corners.length >= 2 && corners.length < CUSTOM_DOWNLOAD_CORNER_COUNT ? boundsFromPoints(corners) : null;
  const completeBounds =
    corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT ? boundsFromPoints(corners) : null;

  if (previewBounds) {
    const [west, south, east, north] = previewBounds;
    features.push({
      type: 'Feature',
      properties: { kind: 'custom-download-preview' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
      },
    });
  }

  if (completeBounds) {
    const [west, south, east, north] = completeBounds;
    features.push({
      type: 'Feature',
      properties: { kind: 'custom-download' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
      },
    });
  }

  if (showEdgePreview && corners.length >= 2) {
    const ring = corners.map((c) => [c.longitude, c.latitude] as [number, number]);
    const complete = corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT;
    if (complete) {
      ring.push(ring[0]!);
    }
    features.push({
      type: 'Feature',
      properties: { kind: complete ? 'custom-download-edge' : 'custom-download-edge-preview' },
      geometry: { type: 'LineString', coordinates: ring },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function customDownloadOverlaySourceKey(corners: DownloadCorner[]): string {
  return corners.map((c) => `${c.id}:${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`).join('|');
}
