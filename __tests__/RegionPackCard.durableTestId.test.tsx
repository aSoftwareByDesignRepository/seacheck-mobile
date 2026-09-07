import React from 'react';
import { render } from '@testing-library/react-native';

import { RegionPackCard } from '../src/features/downloads/RegionPackCard';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { REGION_PACKS } from '../src/map/regionPacks';

const kiel = REGION_PACKS.find((p) => p.id === 'kiel-bay')!;

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('RegionPackCard durable Ready testID (I5 honesty)', () => {
  it('exposes downloads.pack.<id>.durable only for non-cache Ready packs', () => {
    const { getByTestId, queryByTestId, rerender } = wrap(
      <RegionPackCard
        pack={kiel}
        status={{
          regionId: 'kiel-bay',
          state: 'ready',
          percentage: 100,
          packId: 'native-pack-1',
          error: null,
          cacheBacked: false,
        }}
        activeDownloadRegionId={null}
        busy={false}
        onDownload={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(getByTestId('downloads.pack.kiel-bay.durable')).toBeTruthy();
    expect(getByTestId('downloads.delete.kiel-bay')).toBeTruthy();

    rerender(
      <ThemeProvider>
        <RegionPackCard
          pack={kiel}
          status={{
            regionId: 'kiel-bay',
            state: 'ready',
            percentage: 100,
            packId: 'cache:kiel-bay',
            error: null,
            cacheBacked: true,
          }}
          activeDownloadRegionId={null}
          busy={false}
          onDownload={() => {}}
          onDelete={() => {}}
        />
      </ThemeProvider>,
    );
    expect(queryByTestId('downloads.pack.kiel-bay.durable')).toBeNull();
    expect(getByTestId('downloads.pack.kiel-bay')).toBeTruthy();
  });

  it('keeps the base pack testID while downloading', () => {
    const { getByTestId, queryByTestId } = wrap(
      <RegionPackCard
        pack={kiel}
        status={{
          regionId: 'kiel-bay',
          state: 'downloading',
          percentage: 40,
          packId: 'cache:kiel-bay',
          error: null,
          cacheBacked: true,
          downloadInitializing: false,
        }}
        activeDownloadRegionId="kiel-bay"
        busy={false}
        onDownload={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(getByTestId('downloads.pack.kiel-bay')).toBeTruthy();
    expect(queryByTestId('downloads.pack.kiel-bay.durable')).toBeNull();
  });
});
