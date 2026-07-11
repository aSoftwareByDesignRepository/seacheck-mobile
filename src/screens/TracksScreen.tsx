import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { TrackDetailPanel } from '../features/tracks/TrackDetailPanel';
import { openSystemSettings, requestBackgroundLocationAccess, requestForegroundLocationAccess } from '../lib/permissions/locationPermissions';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { requestConfirm } from '../store/confirmStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { isBackgroundLocationRunning } from '../services/backgroundLocationService';
import { syncForegroundLocationWatch } from '../lib/geo/syncForegroundLocationWatch';
import { useLocationStore } from '../services/locationService';
import type { TrackPointRow } from '../lib/db/database';
import { useSettingsStore } from '../store/settingsStore';
import { formatDistanceNm, distanceUnitLabel } from '../lib/geo/units';
import { useTrackStore } from '../store/trackStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { SelectHint } from '../ui/SelectHint';
import { StatusBadge } from '../ui/StatusBadge';

export function TracksScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const tracks = useTrackStore((s) => s.tracks);
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);
  const startRecording = useTrackStore((s) => s.startRecording);
  const stopRecording = useTrackStore((s) => s.stopRecording);
  const deleteTrack = useTrackStore((s) => s.deleteTrack);
  const exportGpx = useTrackStore((s) => s.exportGpx);
  const getPoints = useTrackStore((s) => s.getPoints);
  const getTrackDistanceNm = useTrackStore((s) => s.getTrackDistanceNm);
  const setMapPreviewTrack = useTrackStore((s) => s.setMapPreviewTrack);
  const mapPreviewTrackId = useTrackStore((s) => s.mapPreviewTrackId);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const fix = useLocationStore((s) => s.fix);
  const permission = useLocationStore((s) => s.permission);
  const showError = useFeedbackStore((s) => s.showError);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<TrackPointRow[]>([]);
  const [distanceSummaries, setDistanceSummaries] = useState<Record<string, number>>({});

  const useBackgroundPipeline = backgroundTrackRecording && permission === 'background';
  const selected = tracks.find((t) => t.id === selectedId) ?? null;

  const loadPoints = useCallback(
    async (id: string) => {
      setSelectedPoints(await getPoints(id));
    },
    [getPoints],
  );

  useEffect(() => {
    if (selectedId) void loadPoints(selectedId);
    else setSelectedPoints([]);
  }, [selectedId, tracks, loadPoints]);

  useEffect(() => {
    void Promise.all(
      tracks.map(async (track) => {
        const nm = await getTrackDistanceNm(track.id);
        return { id: track.id, nm };
      }),
    ).then((rows) => {
      const map: Record<string, number> = {};
      for (const row of rows) map[row.id] = row.nm;
      setDistanceSummaries(map);
    });
  }, [tracks, getTrackDistanceNm]);

  useEffect(() => {
    if (!recordingTrackId) {
      setBackgroundActive(false);
      return;
    }
    void syncForegroundLocationWatch({ requestIfUndetermined: false });
    const poll = setInterval(() => {
      void isBackgroundLocationRunning().then(setBackgroundActive);
    }, 3000);
    void isBackgroundLocationRunning().then(setBackgroundActive);
    return () => clearInterval(poll);
  }, [recordingTrackId]);

  async function toggleRecording() {
    if (recordingTrackId) {
      const prevId = recordingTrackId;
      await stopRecording();
      if (selectedId === prevId) void loadPoints(prevId);
      return;
    }
    const ok = await syncForegroundLocationWatch({ requestIfUndetermined: true });
    if (!ok) {
      const fg = await requestForegroundLocationAccess();
      if (fg.status !== Location.PermissionStatus.GRANTED) {
        if (fg.blocked) await openSystemSettings();
        showError(t('tracks.locationRequiredBody'));
        return;
      }
    }
    if (backgroundTrackRecording) {
      const bg = await requestBackgroundLocationAccess();
      if (bg.status !== Location.PermissionStatus.GRANTED) {
        if (bg.blocked) await openSystemSettings();
        showError(t('tracks.backgroundDeniedBody'));
      }
    }
    const id = await startRecording();
    setSelectedId(id);
  }

  async function confirmDelete(id: string, name: string) {
    const ok = await requestConfirm({
      title: t('tracks.deleteTitle'),
      message: name,
      confirmLabel: t('tracks.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deleteTrack(id);
    if (selectedId === id) setSelectedId(null);
  }

  const recordingModeLabel = recordingTrackId
    ? useBackgroundPipeline && backgroundActive
      ? t('tracks.recordingBackground')
      : t('tracks.recordingForeground')
    : null;

  const controls = (
    <View style={{ marginBottom: spacing.lg, minHeight: minTouch }}>
      {recordingTrackId ? (
        <StatusBadge label={t('tracks.recording')} variant="warning" />
      ) : (
        <StatusBadge label={t('tracks.idle')} variant="neutral" />
      )}
      {recordingModeLabel ? (
        <Text style={[styles.modeLine, { color: colors.textMuted, marginTop: spacing.sm }]}>{recordingModeLabel}</Text>
      ) : null}
      <Button
        label={recordingTrackId ? t('tracks.stop') : t('tracks.start')}
        onPress={() => void toggleRecording()}
        variant={recordingTrackId ? 'danger' : 'primary'}
        style={{ marginTop: spacing.md }}
        testID="tracks.toggle"
      />
      {fix ? (
        <Text style={[styles.fixLine, { color: colors.textMuted, marginTop: spacing.sm }]}>
          {t('tracks.lastFix', { lat: fix.latitude.toFixed(4), lon: fix.longitude.toFixed(4) })}
        </Text>
      ) : null}
    </View>
  );

  if (tracks.length === 0) {
    return (
      <Screen testID="screen.tracks" title={t('tabs.tracks')} subtitle={t('tracks.subtitle')}>
        {controls}
        <EmptyState testID="tracks.empty" icon="timeline" title={t('tracks.emptyTitle')} body={t('tracks.emptyBody')} />
      </Screen>
    );
  }

  const listPane = (
    <View>
      {controls}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedId(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ selected: selectedId === item.id }}
            style={[
              styles.row,
              {
                backgroundColor: selectedId === item.id ? colors.successBg : colors.surface,
                borderColor: selectedId === item.id ? colors.success : colors.border,
                marginBottom: spacing.sm,
                minHeight: minTouch,
              },
            ]}
            testID={`tracks.row.${item.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {new Date(item.started_at).toLocaleString()} · {item.ended_at ? t('tracks.completed') : t('tracks.open')}
              </Text>
              {distanceSummaries[item.id] != null && distanceSummaries[item.id] > 0 ? (
                <Text style={[styles.distance, { color: colors.textMuted }]}>
                  {t('tracks.listDistance', {
                    distance: formatDistanceNm(distanceSummaries[item.id], distanceUnit),
                    unit: distanceUnitLabel(distanceUnit),
                  })}
                </Text>
              ) : null}
            </View>
            {item.id === recordingTrackId ? <StatusBadge label={t('tracks.recording')} variant="warning" /> : null}
          </Pressable>
        )}
      />
    </View>
  );

  const detailPane = selected ? (
    <TrackDetailPanel
      track={selected}
      points={selectedPoints}
      showingOnMap={mapPreviewTrackId === selected.id}
      onShowOnMap={() => {
        void setMapPreviewTrack(selected.id).then(() => navigation.navigate('Map'));
      }}
      onExport={() => void exportGpx(selected.id)}
      onDelete={() => confirmDelete(selected.id, selected.name)}
    />
  ) : (
    <SelectHint testID="tracks.selectHint">{t('tracks.selectHint')}</SelectHint>
  );

  return (
    <Screen testID="screen.tracks" title={t('tabs.tracks')} subtitle={t('tracks.subtitle')}>
      <MasterDetailLayout master={listPane} detail={detailPane} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixLine: { fontSize: 13 },
  modeLine: { fontSize: 13, lineHeight: 18 },
  row: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, lineHeight: 20 },
  distance: { fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
});
