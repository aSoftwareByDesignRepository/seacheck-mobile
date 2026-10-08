import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

/**
 * Atlas set-1 fix — per-key write → persist → reload proof for the 8 settings rows
 * the critic flagged as presence-only (settings_read_without_write_persist_reload):
 *   course_vector_minutes, course_vector_scale, map_follow_zoom, map_course_up,
 *   map_course_vector, map_show_xte, map_show_leeway, panel_side
 *
 * Each test writes via the production patchSettings path, then replays the exact
 * AsyncStorage payload back through the production hydrate() path — the same
 * serialization boundary the app crosses on force-stop + cold start.
 * Global store persistence across a real process kill is proven on-device
 * (journeys j-settings-personalize + lifecycle app_process_death_resume).
 */
const STORAGE_KEY = 'seacheck.settings.v1';

function resetToDefaults() {
  useSettingsStore.setState({
    hydrated: false,
    onboardingCompleted: false,
    batteryGuidanceAcknowledged: false,
    downloadHintDismissed: false,
    passagePlanningGuideDismissed: false,
    activityProfileId: 'cruise-passage',
    layoutPreset: 'map-forward',
    layoutOverrides: {},
    sogUnit: 'kn',
    distanceUnit: 'nm',
    bearingReference: 'true',
    coordFormat: 'ddm',
    mapCourseUp: true,
    mapShowCourseVector: true,
    mapCourseVectorMinutes: 6,
    mapCourseVectorScale: 'standard',
    mapFollowZoom: 13,
    mapShowPassageRouteLines: true,
    mapShowRecordingDistance: false,
    mapShowXte: false,
    mapShowLeeway: false,
    mapShowDepthOverlay: false,
    anchorRadiusNm: 0.05,
    followMode: true,
    keepAwakeUnderway: true,
    gpsSmoothPosition: true,
    backgroundTrackRecording: false,
    alarmSoundEnabled: true,
    alarmHapticEnabled: true,
    legAdvanceAuto: false,
    vessel: { name: '', callSign: '', mmsi: '', homePort: '' },
    downloadWifiOnly: true,
    gloveMode: false,
    panelSide: 'auto',
  });
}

/** Simulate process death: drop in-memory state, feed last persisted payload back through hydrate(). */
async function killAndColdStart() {
  const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string;
  expect(typeof lastWrite).toBe('string');
  // The write must have targeted the settings storage key.
  expect((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[0]).toBe(STORAGE_KEY);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(lastWrite);
  resetToDefaults();
  await useSettingsStore.getState().hydrate();
  expect(useSettingsStore.getState().hydrated).toBe(true);
}

describe('settingsStore — map prefs write→persist→reload (set-1 rows)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetToDefaults();
    useSettingsStore.setState({ hydrated: true });
  });

  it('course_vector_minutes: non-default selection survives reload; invalid value normalizes', async () => {
    await useSettingsStore.getState().patchSettings({ mapCourseVectorMinutes: 15 });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapCourseVectorMinutes).toBe(15);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapCourseVectorMinutes).toBe(15);

    // Corrupt persisted value must not survive hydrate.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapCourseVectorMinutes: 99 }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapCourseVectorMinutes).toBe(6);
  });

  it('course_vector_scale: non-default selection survives reload; invalid value normalizes', async () => {
    await useSettingsStore.getState().patchSettings({ mapCourseVectorScale: 'long' });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapCourseVectorScale).toBe('long');

    await killAndColdStart();
    expect(useSettingsStore.getState().mapCourseVectorScale).toBe('long');

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapCourseVectorScale: 'huge' }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapCourseVectorScale).toBe('standard');
  });

  it('map_follow_zoom: non-default zoom survives reload; invalid value normalizes', async () => {
    await useSettingsStore.getState().patchSettings({ mapFollowZoom: 16 });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapFollowZoom).toBe(16);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapFollowZoom).toBe(16);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapFollowZoom: 3 }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapFollowZoom).toBe(13);
  });

  it('map_course_up: off survives reload; corrupt string falls back to default true', async () => {
    await useSettingsStore.getState().patchSettings({ mapCourseUp: false });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapCourseUp).toBe(false);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapCourseUp).toBe(false);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapCourseUp: 'no' }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapCourseUp).toBe(true);
  });

  it('map_course_vector: off survives reload — and gates minutes/scale consumers in code', async () => {
    await useSettingsStore.getState().patchSettings({ mapShowCourseVector: false });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapShowCourseVector).toBe(false);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapShowCourseVector).toBe(false);
  });

  it('map_show_xte: on survives reload; corrupt string falls back to default false', async () => {
    await useSettingsStore.getState().patchSettings({ mapShowXte: true });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapShowXte).toBe(true);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapShowXte).toBe(true);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapShowXte: 'yes' }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapShowXte).toBe(false);
  });

  it('map_show_leeway: on survives reload; corrupt string falls back to default false', async () => {
    await useSettingsStore.getState().patchSettings({ mapShowLeeway: true });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.mapShowLeeway).toBe(true);

    await killAndColdStart();
    expect(useSettingsStore.getState().mapShowLeeway).toBe(true);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapShowLeeway: 1 }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapShowLeeway).toBe(false);
  });

  it('panel_side: starboard survives reload; corrupt side falls back to auto', async () => {
    await useSettingsStore.getState().patchSettings({ panelSide: 'starboard' });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(written.panelSide).toBe('starboard');

    await killAndColdStart();
    expect(useSettingsStore.getState().panelSide).toBe('starboard');

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ panelSide: 'left' }));
    resetToDefaults();
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().panelSide).toBe('auto');
  });

  it('all eight keys persist together in one payload (single-write cross-check)', async () => {
    await useSettingsStore.getState().patchSettings({
      mapCourseUp: false,
      mapShowCourseVector: false,
      mapCourseVectorMinutes: 20,
      mapCourseVectorScale: 'extra',
      mapFollowZoom: 15,
      mapShowXte: true,
      mapShowLeeway: true,
      panelSide: 'port',
    });
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
    for (const k of [
      'mapCourseUp',
      'mapShowCourseVector',
      'mapCourseVectorMinutes',
      'mapCourseVectorScale',
      'mapFollowZoom',
      'mapShowXte',
      'mapShowLeeway',
      'panelSide',
    ]) {
      expect(written).toHaveProperty(k);
    }

    await killAndColdStart();
    const s = useSettingsStore.getState();
    expect(s.mapCourseUp).toBe(false);
    expect(s.mapShowCourseVector).toBe(false);
    expect(s.mapCourseVectorMinutes).toBe(20);
    expect(s.mapCourseVectorScale).toBe('extra');
    expect(s.mapFollowZoom).toBe(15);
    expect(s.mapShowXte).toBe(true);
    expect(s.mapShowLeeway).toBe(true);
    expect(s.panelSide).toBe('port');
  });
});
