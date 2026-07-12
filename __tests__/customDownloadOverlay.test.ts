import {
  buildCustomDownloadOverlayGeoJson,
  customDownloadOverlaySourceKey,
} from '../src/lib/map/customDownloadOverlay';
import { type DownloadCorner } from '../src/lib/map/customDownloadCorners';

describe('customDownloadOverlay', () => {
  const corners: DownloadCorner[] = [
    { id: 'a', index: 1, latitude: 54.3, longitude: 10.0 },
    { id: 'b', index: 2, latitude: 54.3, longitude: 10.2 },
    { id: 'c', index: 3, latitude: 54.5, longitude: 10.2 },
    { id: 'd', index: 4, latitude: 54.5, longitude: 10.0 },
  ];

  it('builds preview polygon while placing corners', () => {
    const geojson = buildCustomDownloadOverlayGeoJson({
      corners: corners.slice(0, 2),
      showEdgePreview: true,
    });
    const kinds = geojson.features.map((f) => f.properties?.kind);
    expect(kinds).toEqual(expect.arrayContaining(['custom-download-preview', 'custom-download-edge-preview']));
  });

  it('builds complete rectangle overlay for four corners', () => {
    const geojson = buildCustomDownloadOverlayGeoJson({
      corners,
      showEdgePreview: true,
    });
    const kinds = geojson.features.map((f) => f.properties?.kind);
    expect(kinds).toEqual(expect.arrayContaining(['custom-download', 'custom-download-edge']));
  });

  it('changes source key when a corner moves', () => {
    const before = customDownloadOverlaySourceKey(corners);
    const moved = corners.map((c) => (c.id === 'a' ? { ...c, latitude: 54.31 } : c));
    expect(customDownloadOverlaySourceKey(moved)).not.toBe(before);
  });
});
