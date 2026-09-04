import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import type { LonLatPoint } from '../../lib/map/bounds';

type Props = {
  /** Closed ring of lon/lat corners (order preserved). */
  corners: LonLatPoint[];
  /** Optional axis-aligned bounds used to frame the schematic when corners are sparse. */
  bounds?: LngLatBounds | null;
  height: number;
  fillColor: string;
  lineColor: string;
  backgroundColor: string;
  borderColor: string;
  testID?: string;
};

const PAD = 0.12;

/**
 * Non-MapLibre area sketch for panels that share the screen with NavigationMap.
 * Android only allows one reliable MapLibre GL surface — this keeps custom-download
 * and pack previews readable without competing for that context.
 */
export function BoundsAreaSchematic({
  corners,
  bounds,
  height,
  fillColor,
  lineColor,
  backgroundColor,
  borderColor,
  testID,
}: Props) {
  const layout = useMemo(() => {
    if (corners.length === 0 && !bounds) return null;

    let west: number;
    let south: number;
    let east: number;
    let north: number;
    if (bounds) {
      [west, south, east, north] = bounds;
    } else {
      west = Math.min(...corners.map((c) => c.longitude));
      east = Math.max(...corners.map((c) => c.longitude));
      south = Math.min(...corners.map((c) => c.latitude));
      north = Math.max(...corners.map((c) => c.latitude));
    }

    const lonSpan = Math.max(east - west, 1e-6);
    const latSpan = Math.max(north - south, 1e-6);
    const padLon = lonSpan * PAD;
    const padLat = latSpan * PAD;
    const frameWest = west - padLon;
    const frameEast = east + padLon;
    const frameSouth = south - padLat;
    const frameNorth = north + padLat;
    const frameLon = frameEast - frameWest;
    const frameLat = frameNorth - frameSouth;

    const project = (lon: number, lat: number) => ({
      left: ((lon - frameWest) / frameLon) * 100,
      top: ((frameNorth - lat) / frameLat) * 100,
    });

    const ring =
      corners.length >= 2
        ? corners
        : [
            { longitude: west, latitude: south },
            { longitude: east, latitude: south },
            { longitude: east, latitude: north },
            { longitude: west, latitude: north },
          ];

    const points = ring.map((c) => project(c.longitude, c.latitude));
    const xs = points.map((p) => p.left);
    const ys = points.map((p) => p.top);
    const box = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };

    return { points, box };
  }, [corners, bounds]);

  if (!layout) return null;

  return (
    <View
      style={[styles.frame, { height, backgroundColor, borderColor }]}
      testID={testID}
    >
      <View
        style={[
          styles.fill,
          {
            left: `${layout.box.left}%`,
            top: `${layout.box.top}%`,
            width: `${Math.max(layout.box.width, 2)}%`,
            height: `${Math.max(layout.box.height, 2)}%`,
            backgroundColor: fillColor,
            borderColor: lineColor,
          },
        ]}
      />
      {layout.points.map((point, index) => (
        <View
          key={`corner-${index}`}
          style={[
            styles.corner,
            {
              left: `${point.left}%`,
              top: `${point.top}%`,
              backgroundColor: lineColor,
              borderColor: backgroundColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 4,
    opacity: 0.85,
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    borderWidth: 2,
  },
});
