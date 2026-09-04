import { TransformRequestManager } from '@maplibre/maplibre-react-native';

import {
  buildChartTileUserAgent,
  configureChartTileHttp,
  resetChartTileHttpForTests,
} from '../src/lib/map/configureChartTileHttp';

jest.mock('@maplibre/maplibre-react-native', () => ({
  TransformRequestManager: {
    addHeader: jest.fn(),
    removeHeader: jest.fn(),
  },
}));

describe('configureChartTileHttp', () => {
  beforeEach(() => {
    resetChartTileHttpForTests();
    jest.mocked(TransformRequestManager.addHeader).mockClear();
    jest.mocked(TransformRequestManager.removeHeader).mockClear();
  });

  it('registers a SeaCheck-identifying User-Agent once', () => {
    configureChartTileHttp();
    configureChartTileHttp();
    expect(TransformRequestManager.addHeader).toHaveBeenCalledTimes(1);
    expect(TransformRequestManager.addHeader).toHaveBeenCalledWith({
      id: 'seacheck-chart-tiles',
      name: 'User-Agent',
      value: expect.stringMatching(/^SeaCheck\/\d+\.\d+\.\d+ \(\+https:\/\/software-by-design\.de\/seacheck\)$/),
    });
  });

  it('buildChartTileUserAgent includes app version', () => {
    expect(buildChartTileUserAgent()).toMatch(/^SeaCheck\//);
  });
});

describe('App tile User-Agent boot contract', () => {
  it('registers configureChartTileHttp at module scope before export default', () => {
    const { readFileSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const src = readFileSync(join(__dirname, '../App.tsx'), 'utf8');
    const [beforeExport = ''] = src.split('export default');
    expect(beforeExport).toContain('configureChartTileHttp()');
  });
});
