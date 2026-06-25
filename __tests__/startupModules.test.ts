/**
 * Guards against startup circular-import regressions that crash Hermes before the first frame.
 * The background GPS task chain must not import stores at module load time.
 */
describe('startup module graph', () => {
  it('exposes the background task name from a leaf module', () => {
    const { TRACK_LOCATION_TASK } = require('../src/services/trackLocationTaskConstants') as {
      TRACK_LOCATION_TASK: string;
    };
    expect(TRACK_LOCATION_TASK).toBe('seacheck-track-recording');
  });

  it('loads background location service without pulling in trackBackgroundTask', () => {
    const bg = require('../src/services/backgroundLocationService') as {
      syncBackgroundLocationMonitoring: () => Promise<unknown>;
    };
    expect(typeof bg.syncBackgroundLocationMonitoring).toBe('function');
  });

  it('registers the background task module without throwing', () => {
    expect(() => {
      require('../src/services/trackBackgroundTask');
    }).not.toThrow();
  });

  it('loads alarm coordinator after task constants are available', () => {
    const { processFixFromLocation } = require('../src/lib/alarms/alarmCoordinator') as {
      processFixFromLocation: () => Promise<unknown>;
    };
    expect(typeof processFixFromLocation).toBe('function');
  });

  it('loads settings store without a settings→services→alarms cycle', () => {
    expect(() => {
      require('../src/store/settingsStore');
    }).not.toThrow();
  });

  it('loads initializeAppServices without pulling stores at module init', () => {
    expect(() => {
      require('../src/lib/permissions/initializeAppServices');
    }).not.toThrow();
  });

  it('loads location service without navigation store at module init', () => {
    expect(() => {
      require('../src/services/locationService');
    }).not.toThrow();
  });

  it('loads alarm feedback service without eager expo-audio or expo-haptics', () => {
    expect(() => {
      require('../src/services/alarmFeedbackService');
    }).not.toThrow();
  });

  it('loads battery optimization without eager expo-battery', () => {
    expect(() => {
      require('../src/lib/permissions/batteryOptimization');
    }).not.toThrow();
  });
});
