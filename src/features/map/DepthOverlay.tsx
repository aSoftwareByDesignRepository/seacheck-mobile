import { Layer, RasterSource } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import {
  DEPTH_GEBCO_ATTRIBUTION,
  DEPTH_GEBCO_LAYER_ID,
  DEPTH_GEBCO_MAX_ZOOM,
  DEPTH_GEBCO_OPACITY,
  DEPTH_GEBCO_SOURCE_ID,
  DEPTH_INSERT_BEFORE_LAYER_ID,
  DEPTH_MIN_ZOOM,
  DEPTH_TRACKS_ATTRIBUTION,
  DEPTH_TRACKS_LAYER_ID,
  DEPTH_TRACKS_MAX_ZOOM,
  DEPTH_TRACKS_OPACITY,
  DEPTH_TRACKS_SOURCE_ID,
  depthGebcoTileUrl,
  depthTracksTileUrl,
} from '../../lib/settings/chartDepthOverlay';

type Props = {
  /** When false, render nothing (caller also gates mount). */
  visible: boolean;
};

/**
 * Online-only depth overlay: GEBCO bathymetric shade + OpenSeaMap track depths.
 * Mounted as Map children — never written into the offline pack style file.
 */
function DepthOverlayComponent({ visible }: Props) {
  if (!visible) return null;

  const gebcoUrl = depthGebcoTileUrl();
  const tracksUrl = depthTracksTileUrl();

  return (
    <>
      <RasterSource
        id={DEPTH_GEBCO_SOURCE_ID}
        tileSize={256}
        minzoom={DEPTH_MIN_ZOOM}
        maxzoom={DEPTH_GEBCO_MAX_ZOOM}
        tiles={[gebcoUrl]}
        attribution={DEPTH_GEBCO_ATTRIBUTION}
      >
        <Layer
          id={DEPTH_GEBCO_LAYER_ID}
          type="raster"
          beforeId={DEPTH_INSERT_BEFORE_LAYER_ID}
          minzoom={DEPTH_MIN_ZOOM}
          maxzoom={DEPTH_GEBCO_MAX_ZOOM}
          paint={{ 'raster-opacity': DEPTH_GEBCO_OPACITY }}
        />
      </RasterSource>
      <RasterSource
        id={DEPTH_TRACKS_SOURCE_ID}
        tileSize={256}
        minzoom={DEPTH_MIN_ZOOM}
        maxzoom={DEPTH_TRACKS_MAX_ZOOM}
        tiles={[tracksUrl]}
        attribution={DEPTH_TRACKS_ATTRIBUTION}
      >
        <Layer
          id={DEPTH_TRACKS_LAYER_ID}
          type="raster"
          beforeId={DEPTH_INSERT_BEFORE_LAYER_ID}
          minzoom={DEPTH_MIN_ZOOM}
          maxzoom={DEPTH_TRACKS_MAX_ZOOM}
          paint={{ 'raster-opacity': DEPTH_TRACKS_OPACITY }}
        />
      </RasterSource>
    </>
  );
}

export const DepthOverlay = memo(DepthOverlayComponent);
