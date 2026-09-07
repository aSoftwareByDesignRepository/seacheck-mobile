import React from 'react';
import { render } from '@testing-library/react-native';

import { CustomPackCard } from '../src/features/downloads/CustomPackCard';
import { ThemeProvider } from '../src/theme/ThemeContext';
import type { RegionPackStatus } from '../src/store/offlinePackStore';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function makeStatus(overrides: Partial<RegionPackStatus> = {}): RegionPackStatus {
  return {
    regionId: 'custom-abc',
    displayName: 'My area',
    state: 'ready',
    percentage: 100,
    error: null,
    packId: 'pack-custom',
    cacheBacked: false,
    ...overrides,
  };
}

describe('CustomPackCard durable Ready testID', () => {
  it('exposes downloads.custom.<id>.durable only for non-cache Ready packs', () => {
    const { getByTestId, rerender, queryByTestId } = wrap(
      <CustomPackCard
        status={makeStatus()}
        activeDownloadRegionId={null}
        onDownload={() => {}}
        onDelete={() => {}}
        busy={false}
      />,
    );
    expect(getByTestId('downloads.custom.custom-abc.durable')).toBeTruthy();

    rerender(
      <ThemeProvider>
        <CustomPackCard
          status={makeStatus({ cacheBacked: true, packId: null })}
          activeDownloadRegionId={null}
          onDownload={() => {}}
          onDelete={() => {}}
          busy={false}
        />
      </ThemeProvider>,
    );
    expect(queryByTestId('downloads.custom.custom-abc.durable')).toBeNull();
    expect(getByTestId('downloads.custom.custom-abc')).toBeTruthy();
  });
});
