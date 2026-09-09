describe('configureMapLogging', () => {
  it('starts LogManager once and registers a tile-timeout filter', () => {
    jest.isolateModules(() => {
      const { LogManager } = require('@maplibre/maplibre-react-native') as {
        LogManager: { start: jest.Mock; onLog: jest.Mock };
      };
      LogManager.start.mockClear();
      LogManager.onLog.mockClear();

      const { configureMapLogging } = require('../src/map/mapLogging') as {
        configureMapLogging: () => void;
      };

      configureMapLogging();
      configureMapLogging();

      expect(LogManager.start).toHaveBeenCalledTimes(1);
      expect(LogManager.onLog).toHaveBeenCalledTimes(1);

      const filter = LogManager.onLog.mock.calls[0]?.[0] as (event: {
        level: string;
        message: string;
      }) => boolean;
      expect(filter({ level: 'error', message: 'Failed to load tile … timeout' })).toBe(true);
      expect(filter({ level: 'error', message: 'other error' })).toBe(false);
      expect(filter({ level: 'info', message: 'Failed to load tile timeout' })).toBe(false);
    });
  });
});
