import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  buildCustomDownloadOverlayGeoJson,
  CUSTOM_DOWNLOAD_OVERLAY_COLORS,
  customDownloadOverlaySourceKey,
} from '../../lib/map/customDownloadOverlay';
import { useCustomDownloadStore } from '../../store/customDownloadStore';

function CornerBadge({ index, selected }: { index: number; selected: boolean }) {
  return (
    <View
      style={[styles.badge, selected ? styles.badgeSelected : null]}
      accessibilityRole="text"
      accessibilityLabel={String(index)}
    >
      <Text style={styles.badgeText}>{index}</Text>
    </View>
  );
}

export function CustomDownloadOverlays() {
  const selecting = useCustomDownloadStore((s) => s.selecting);
  const corners = useCustomDownloadStore((s) => s.corners);
  const selectedCornerId = useCustomDownloadStore((s) => s.selectedCornerId);

  const sourceKey = useMemo(() => customDownloadOverlaySourceKey(corners), [corners]);
  const geojson = useMemo(
    () =>
      buildCustomDownloadOverlayGeoJson({
        corners,
        showEdgePreview: selecting,
      }),
    [corners, selecting],
  );

  if (!selecting || corners.length === 0) return null;

  return (
    <>
      <GeoJSONSource key={sourceKey} id="seacheck-custom-download" data={geojson}>
        <Layer
          id="seacheck-custom-download-edge-preview"
          type="line"
          filter={['==', ['get', 'kind'], 'custom-download-edge-preview']}
          paint={{
            'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.previewLine,
            'line-width': 3,
            'line-opacity': 0.95,
            'line-dasharray': [3, 2],
          }}
        />
        <Layer
          id="seacheck-custom-download-edge"
          type="line"
          filter={['==', ['get', 'kind'], 'custom-download-edge']}
          paint={{
            'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.line,
            'line-width': 4,
            'line-opacity': 1,
          }}
        />
        <Layer
          id="seacheck-custom-download-preview-fill"
          type="fill"
          filter={['==', ['get', 'kind'], 'custom-download-preview']}
          paint={{
            'fill-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.previewFill,
            'fill-opacity': 0.22,
          }}
        />
        <Layer
          id="seacheck-custom-download-preview-line"
          type="line"
          filter={['==', ['get', 'kind'], 'custom-download-preview']}
          paint={{
            'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.previewLine,
            'line-width': 3,
            'line-opacity': 0.95,
            'line-dasharray': [4, 3],
          }}
        />
        <Layer
          id="seacheck-custom-download-fill"
          type="fill"
          filter={['==', ['get', 'kind'], 'custom-download']}
          paint={{
            'fill-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.fill,
            'fill-opacity': 0.28,
          }}
        />
        <Layer
          id="seacheck-custom-download-line"
          type="line"
          filter={['==', ['get', 'kind'], 'custom-download']}
          paint={{
            'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.line,
            'line-width': 4,
            'line-opacity': 1,
          }}
        />
      </GeoJSONSource>
      {corners.map((corner) => (
        <ViewAnnotation
          key={corner.id}
          id={`custom-corner-${corner.id}`}
          lngLat={[corner.longitude, corner.latitude]}
          anchor="center"
        >
          <CornerBadge index={corner.index} selected={corner.id === selectedCornerId} />
        </ViewAnnotation>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CUSTOM_DOWNLOAD_OVERLAY_COLORS.corner,
    borderWidth: 3,
    borderColor: CUSTOM_DOWNLOAD_OVERLAY_COLORS.cornerStroke,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeSelected: {
    backgroundColor: CUSTOM_DOWNLOAD_OVERLAY_COLORS.cornerSelected,
    transform: [{ scale: 1.12 }],
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
});
