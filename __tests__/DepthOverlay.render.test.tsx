import React from 'react';
import { render } from '@testing-library/react-native';

import {
  DEPTH_GEBCO_SOURCE_ID,
  DEPTH_TRACKS_SOURCE_ID,
  depthGebcoTileUrl,
  depthTracksTileUrl,
} from '../src/lib/settings/chartDepthOverlay';
import { DepthOverlay } from '../src/features/map/DepthOverlay';

jest.mock('@maplibre/maplibre-react-native', () => {
  const ReactLocal = require('react');
  const { View, Text } = require('react-native');
  return {
    RasterSource: ({ id, tiles, children }: { id: string; tiles: string[]; children?: React.ReactNode }) =>
      ReactLocal.createElement(
        View,
        { testID: `raster.${id}`, accessibilityLabel: tiles.join('|') },
        children,
        ReactLocal.createElement(Text, { testID: `raster.${id}.tiles` }, tiles.join('|')),
      ),
    Layer: ({ id }: { id: string }) => ReactLocal.createElement(View, { testID: `layer.${id}` }),
  };
});

describe('DepthOverlay mount contract', () => {
  it('renders nothing when not visible (no WMS sources)', () => {
    const { queryByTestId } = render(<DepthOverlay visible={false} />);
    expect(queryByTestId(`raster.${DEPTH_GEBCO_SOURCE_ID}`)).toBeNull();
    expect(queryByTestId(`raster.${DEPTH_TRACKS_SOURCE_ID}`)).toBeNull();
  });

  it('mounts allowlisted GEBCO + track WMS tile URLs when visible', () => {
    const { getByTestId } = render(<DepthOverlay visible />);
    const gebcoTiles = getByTestId(`raster.${DEPTH_GEBCO_SOURCE_ID}.tiles`).props.children as string;
    const trackTiles = getByTestId(`raster.${DEPTH_TRACKS_SOURCE_ID}.tiles`).props.children as string;
    expect(gebcoTiles).toBe(depthGebcoTileUrl());
    expect(trackTiles).toBe(depthTracksTileUrl());
    expect(gebcoTiles).toContain('geoserver.openseamap.org');
    expect(trackTiles).toContain('depth.openseamap.org');
    expect(gebcoTiles).not.toContain('evil.');
  });
});
