import { Text, View } from 'react-native';

import { ChartDataSettingsGroup } from '../../features/settings/ChartDataSettingsGroup';
import { settingsStyles } from '../../features/settings/settingsStyles';
import { courseVectorScaleLabelKey } from '../../lib/settings/courseVectorLabels';
import { COURSE_VECTOR_MINUTE_OPTIONS, COURSE_VECTOR_SCALE_OPTIONS, FOLLOW_ZOOM_OPTIONS } from '../../lib/settings/mapSettings';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';
import { Card, Screen, SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

export function SettingsMapScreen() {
  const { colors, minTouch } = useTheme();
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const mapShowCourseVector = useSettingsStore((s) => s.mapShowCourseVector);
  const mapCourseVectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const mapCourseVectorScale = useSettingsStore((s) => s.mapCourseVectorScale);
  const mapFollowZoom = useSettingsStore((s) => s.mapFollowZoom);
  const followMode = useSettingsStore((s) => s.followMode);
  const gpsSmoothPosition = useSettingsStore((s) => s.gpsSmoothPosition);
  const barometerEnabled = useSettingsStore((s) => s.barometerEnabled);
  const mapShowPassageRouteLines = useSettingsStore((s) => s.mapShowPassageRouteLines);
  const mapShowRecordingDistance = useSettingsStore((s) => s.mapShowRecordingDistance);
  const downloadWifiOnly = useSettingsStore((s) => s.downloadWifiOnly);

  return (
    <Screen testID="screen.settings.map">
      <Card>
        <SettingsGroup title={t('settings.mapBehaviourTitle')} first>
          <ToggleRow
            label={t('settings.courseUp')}
            value={mapCourseUp}
            onChange={(v) => void patchSettings({ mapCourseUp: v })}
            testID="settings.courseUp"
            colors={colors}
            minTouch={minTouch}
          />
          <ToggleRow
            label={t('settings.courseVector')}
            hint={t('settings.courseVectorHint')}
            value={mapShowCourseVector}
            onChange={(v) => void patchSettings({ mapShowCourseVector: v })}
            testID="settings.courseVector"
            colors={colors}
            minTouch={minTouch}
          />
          {mapShowCourseVector ? (
            <>
              <SettingsGroup title={t('settings.courseVectorMinutes')} hint={t('settings.courseVectorMinutesHint')}>
                <View style={settingsStyles.chipRow}>
                  {COURSE_VECTOR_MINUTE_OPTIONS.map((min) => (
                    <FilterChip
                      key={min}
                      label={t('settings.courseVectorMinutesOption', { min })}
                      selected={mapCourseVectorMinutes === min}
                      onPress={() => void patchSettings({ mapCourseVectorMinutes: min })}
                      testID={`settings.courseVectorMinutes.${min}`}
                    />
                  ))}
                </View>
              </SettingsGroup>
              <SettingsGroup title={t('settings.courseVectorScale')} hint={t('settings.courseVectorScaleHint')}>
                <View style={settingsStyles.chipRow}>
                  {COURSE_VECTOR_SCALE_OPTIONS.map((scale) => (
                    <FilterChip
                      key={scale}
                      label={t(courseVectorScaleLabelKey(scale))}
                      selected={mapCourseVectorScale === scale}
                      onPress={() => void patchSettings({ mapCourseVectorScale: scale })}
                      testID={`settings.courseVectorScale.${scale}`}
                    />
                  ))}
                </View>
                <Text style={[settingsStyles.bodyText, { color: colors.textMuted, marginTop: 8 }]}>{t('settings.courseVectorZoomHint')}</Text>
              </SettingsGroup>
            </>
          ) : null}
          <SettingsGroup title={t('settings.followZoom')} hint={t('settings.followZoomHint')}>
            <View style={settingsStyles.chipRow}>
              {FOLLOW_ZOOM_OPTIONS.map((zoom) => (
                <FilterChip
                  key={zoom}
                  label={String(zoom)}
                  selected={mapFollowZoom === zoom}
                  onPress={() => void patchSettings({ mapFollowZoom: zoom })}
                  testID={`settings.followZoom.${zoom}`}
                />
              ))}
            </View>
          </SettingsGroup>
          <ToggleRow
            label={t('settings.followMode')}
            value={followMode}
            onChange={(v) => void patchSettings({ followMode: v })}
            testID="settings.followMode"
            colors={colors}
            minTouch={minTouch}
          />
          <ToggleRow
            label={t('settings.gpsSmoothPosition')}
            hint={t('settings.gpsSmoothPositionHint')}
            value={gpsSmoothPosition}
            onChange={(v) => void patchSettings({ gpsSmoothPosition: v })}
            testID="settings.gpsSmoothPosition"
            colors={colors}
            minTouch={minTouch}
          />
          <ToggleRow
            label={t('settings.barometerEnabled')}
            hint={t('settings.barometerEnabledHint')}
            value={barometerEnabled}
            onChange={(v) => void patchSettings({ barometerEnabled: v })}
            testID="settings.barometerEnabled"
            colors={colors}
            minTouch={minTouch}
          />
          <ToggleRow
            label={t('settings.mapShowPassageRouteLines')}
            hint={t('settings.mapShowPassageRouteLinesHint')}
            value={mapShowPassageRouteLines}
            onChange={(v) => void patchSettings({ mapShowPassageRouteLines: v })}
            testID="settings.mapShowPassageRouteLines"
            colors={colors}
            minTouch={minTouch}
          />
          <ToggleRow
            label={t('settings.mapShowRecordingDistance')}
            hint={t('settings.mapShowRecordingDistanceHint')}
            value={mapShowRecordingDistance}
            onChange={(v) => void patchSettings({ mapShowRecordingDistance: v })}
            testID="settings.mapShowRecordingDistance"
            colors={colors}
            minTouch={minTouch}
          />
        </SettingsGroup>

        <ChartDataSettingsGroup />

        <SettingsGroup title={t('settings.downloadsTitle')} hint={t('settings.downloadsSummary')}>
          <ToggleRow
            label={t('downloads.wifiOnly')}
            hint={t('downloads.wifiOnlyHint')}
            value={downloadWifiOnly}
            onChange={(v) => void patchSettings({ downloadWifiOnly: v })}
            testID="settings.downloadWifiOnly"
            colors={colors}
            minTouch={minTouch}
          />
        </SettingsGroup>
      </Card>
    </Screen>
  );
}
