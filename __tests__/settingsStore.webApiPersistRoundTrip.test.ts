import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

/**
 * web_api lane: every PersistPayload knob must prove read → write_valid → persist/reload
 * → invalid rejected (Policy 3.5.5 settings-matrix). Local-only; no NC AuthZ surface.
 */
describe('settingsStore web_api persist round-trip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  async function persistThenReload() {
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string;
    expect(typeof lastWrite).toBe('string');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(lastWrite);
    useSettingsStore.setState({ hydrated: false });
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().hydrated).toBe(true);
  }

  it('round-trips units + map enums with invalid reject', async () => {
    useSettingsStore.setState({ hydrated: true });
    await useSettingsStore.getState().patchSettings({
      sogUnit: 'kmh',
      distanceUnit: 'km',
      bearingReference: 'magnetic',
      coordFormat: 'dms',
      mapCourseVectorMinutes: 15,
      mapCourseVectorScale: 'long',
      mapFollowZoom: 16,
      anchorRadiusNm: 0.2,
      panelSide: 'port',
    });
    await persistThenReload();
    const s = useSettingsStore.getState();
    expect(s.sogUnit).toBe('kmh');
    expect(s.distanceUnit).toBe('km');
    expect(s.bearingReference).toBe('magnetic');
    expect(s.coordFormat).toBe('dms');
    expect(s.mapCourseVectorMinutes).toBe(15);
    expect(s.mapCourseVectorScale).toBe('long');
    expect(s.mapFollowZoom).toBe(16);
    expect(s.anchorRadiusNm).toBe(0.2);
    expect(s.panelSide).toBe('port');

    await useSettingsStore.getState().patchSettings({
      sogUnit: 'nope' as 'kn',
      mapCourseVectorMinutes: 99 as 6,
      panelSide: 'left' as 'auto',
    });
    expect(useSettingsStore.getState().sogUnit).toBe('kmh');
    // hydrate path normalizes out-of-range minutes; patch passes through until hydrate —
    // assert hydrate reject for corrupt panelSide + minutes
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ ...JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]), panelSide: 'left', mapCourseVectorMinutes: 99 }),
    );
    useSettingsStore.setState({ hydrated: false });
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().panelSide).toBe('auto');
    expect(useSettingsStore.getState().mapCourseVectorMinutes).toBe(6);
  });

  it('round-trips safety + map display booleans', async () => {
    useSettingsStore.setState({ hydrated: true });
    await useSettingsStore.getState().patchSettings({
      mapCourseUp: false,
      mapShowCourseVector: false,
      mapShowPassageRouteLines: false,
      mapShowRecordingDistance: true,
      mapShowXte: true,
      mapShowLeeway: true,
      mapShowDepthOverlay: true,
      followMode: false,
      keepAwakeUnderway: false,
      gpsSmoothPosition: false,
      backgroundTrackRecording: true,
      alarmSoundEnabled: false,
      alarmHapticEnabled: false,
      legAdvanceAuto: true,
      downloadWifiOnly: false,
      gloveMode: true,
      onboardingCompleted: true,
      batteryGuidanceAcknowledged: true,
      downloadHintDismissed: true,
      passagePlanningGuideDismissed: true,
    });
    await persistThenReload();
    const s = useSettingsStore.getState();
    expect(s.mapShowDepthOverlay).toBe(true);
    expect(s.downloadWifiOnly).toBe(false);
    expect(s.gloveMode).toBe(true);
    expect(s.backgroundTrackRecording).toBe(true);
    expect(s.alarmSoundEnabled).toBe(false);
    expect(s.followMode).toBe(false);

    await useSettingsStore.getState().patchSettings({
      mapShowDepthOverlay: 'yes' as unknown as boolean,
      downloadWifiOnly: 0 as unknown as boolean,
    });
    // corrupt values fall back to current — never leave non-booleans; 0 must not flip wifi-only off→on
    expect(useSettingsStore.getState().mapShowDepthOverlay).toBe(true);
    expect(useSettingsStore.getState().downloadWifiOnly).toBe(false);

    useSettingsStore.setState({ downloadWifiOnly: true });
    await useSettingsStore.getState().patchSettings({ downloadWifiOnly: 0 as unknown as boolean });
    expect(useSettingsStore.getState().downloadWifiOnly).toBe(true);
  });

  it('round-trips vessel + activity profile apply', async () => {
    useSettingsStore.setState({ hydrated: true });
    await useSettingsStore.getState().updateVessel({
      name: 'Aurora',
      callSign: 'DF1234',
      mmsi: '211234567',
      homePort: 'Rostock',
    });
    await persistThenReload();
    expect(useSettingsStore.getState().vessel).toEqual({
      name: 'Aurora',
      callSign: 'DF1234',
      mmsi: '211234567',
      homePort: 'Rostock',
    });

    await useSettingsStore.getState().applyActivityProfile('cruise-passage');
    await persistThenReload();
    expect(useSettingsStore.getState().activityProfileId).toBe('cruise-passage');

    // legacy / removed profile ids normalize to cruise-passage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ activityProfileId: 'sailing-race' }));
    useSettingsStore.setState({ hydrated: false });
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().activityProfileId).toBe('cruise-passage');
  });

  it('setLayoutOverride persists and reloads', async () => {
    useSettingsStore.setState({ hydrated: true });
    await useSettingsStore.getState().setLayoutOverride('instruments-only', {
      profileId: 'cruise-passage',
      bucket: 'compact',
      isLandscape: false,
    });
    await persistThenReload();
    const overrides = useSettingsStore.getState().layoutOverrides;
    expect(Object.values(overrides)).toContain('instruments-only');
  });
});
