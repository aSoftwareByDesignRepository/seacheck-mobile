import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { isBackgroundTrackTaskRunning } from '../services/trackRecordingService';
import { displayCog, isFixStale, useLocationStore } from '../services/locationService';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { StatusBadge } from '../ui/StatusBadge';

export function TracksScreen() {
  const { colors, spacing, minTouch } = useTheme();
  const tracks = useTrackStore((s) => s.tracks);
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);
  const startRecording = useTrackStore((s) => s.startRecording);
  const stopRecording = useTrackStore((s) => s.stopRecording);
  const deleteTrack = useTrackStore((s) => s.deleteTrack);
  const exportGpx = useTrackStore((s) => s.exportGpx);
  const appendPoint = useTrackStore((s) => s.appendPoint);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const fix = useLocationStore((s) => s.fix);
  const permission = useLocationStore((s) => s.permission);
  const startWatching = useLocationStore((s) => s.startWatching);
  const [backgroundActive, setBackgroundActive] = useState(false);

  const useBackgroundPipeline = backgroundTrackRecording && permission === 'background';

  useEffect(() => {
    if (!recordingTrackId) {
      setBackgroundActive(false);
      return;
    }
    void startWatching();
    const poll = setInterval(() => {
      void isBackgroundTrackTaskRunning().then(setBackgroundActive);
    }, 3000);
    void isBackgroundTrackTaskRunning().then(setBackgroundActive);
    return () => clearInterval(poll);
  }, [recordingTrackId, startWatching]);

  useEffect(() => {
    if (!recordingTrackId || useBackgroundPipeline) return;
    const id = setInterval(() => {
      const current = useLocationStore.getState().fix;
      if (!current || isFixStale(current, 5000)) return;
      void appendPoint({
        latitude: current.latitude,
        longitude: current.longitude,
        sog_ms: current.speedMs,
        cog_deg: displayCog(current),
      });
    }, 2000);
    return () => clearInterval(id);
  }, [recordingTrackId, useBackgroundPipeline, appendPoint]);

  async function toggleRecording() {
    if (recordingTrackId) {
      await stopRecording();
      return;
    }
    const ok = await startWatching();
    if (!ok) {
      Alert.alert(t('tracks.locationRequiredTitle'), t('tracks.locationRequiredBody'));
      return;
    }
    if (backgroundTrackRecording) {
      const bg = await Location.requestBackgroundPermissionsAsync();
      await useLocationStore.getState().refreshPermission();
      if (bg.status !== 'granted') {
        Alert.alert(t('tracks.backgroundDeniedTitle'), t('tracks.backgroundDeniedBody'));
      }
    }
    await startRecording();
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(t('tracks.deleteTitle'), name, [
      { text: t('common.dismiss'), style: 'cancel' },
      { text: t('tracks.delete'), style: 'destructive', onPress: () => void deleteTrack(id) },
    ]);
  }

  const recordingModeLabel = recordingTrackId
    ? useBackgroundPipeline && backgroundActive
      ? t('tracks.recordingBackground')
      : t('tracks.recordingForeground')
    : null;

  return (
    <Screen testID="screen.tracks" title={t('tabs.tracks')} subtitle={t('tracks.subtitle')}>
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

      {tracks.length === 0 ? (
        <EmptyState testID="tracks.empty" icon="timeline" title={t('tracks.emptyTitle')} body={t('tracks.emptyBody')} />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.md }]}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {new Date(item.started_at).toLocaleString()} · {item.ended_at ? t('tracks.completed') : t('tracks.open')}
              </Text>
              <View style={styles.actions}>
                <Button label={t('tracks.exportGpx')} variant="secondary" onPress={() => void exportGpx(item.id)} testID={`tracks.export.${item.id}`} />
                <Button label={t('tracks.delete')} variant="danger" onPress={() => confirmDelete(item.id, item.name)} testID={`tracks.delete.${item.id}`} />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixLine: { fontSize: 13 },
  modeLine: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, marginBottom: 12 },
  actions: { gap: 8 },
});
