import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PassageCoverageCard } from '../features/passage/PassageCoverageCard';
import { PassageEditorPanel } from '../features/passage/PassageEditorPanel';
import { PassageMetaSection } from '../features/passage/PassageMetaSection';
import { PassageWaypointSection } from '../features/passage/PassageWaypointSection';
import { usePassageCoverage } from '../hooks/usePassageCoverage';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import type { PassageLeg, PassageWithLegs } from '../store/passageStore';
import { usePassageStore } from '../store/passageStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useWaypointStore } from '../store/waypointStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { StatusBadge } from '../ui/StatusBadge';

export function PassageScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing } = useTheme();
  const passages = usePassageStore((s) => s.passages);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const createPassage = usePassageStore((s) => s.createPassage);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const deactivatePassage = usePassageStore((s) => s.deactivatePassage);
  const addWaypointToPassage = usePassageStore((s) => s.addWaypointToPassage);
  const removeWaypointFromPassage = usePassageStore((s) => s.removeWaypointFromPassage);
  const reorderWaypointInPassage = usePassageStore((s) => s.reorderWaypointInPassage);
  const setPassageMeta = usePassageStore((s) => s.setPassageMeta);
  const setLegOverride = usePassageStore((s) => s.setLegOverride);
  const exportPassageGpx = usePassageStore((s) => s.exportPassageGpx);
  const buildPassageSummary = usePassageStore((s) => s.buildPassageSummary);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const waypoints = useWaypointStore((s) => s.items);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PassageWithLegs | null>(null);
  const [editorPane, setEditorPane] = useState<'table' | 'map'>('table');
  const [highlightedLegIndex, setHighlightedLegIndex] = useState<number | null>(null);
  const coverage = usePassageCoverage(detail?.waypoints ?? []);

  const loadDetail = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetail(await getPassageDetail(id));
    },
    [getPassageDetail],
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [passages, selectedId, loadDetail]);

  async function handleCreate() {
    const p = await createPassage(t('passage.defaultName'));
    if (waypoints.length >= 2) {
      for (const wp of waypoints.slice(0, 2)) {
        await addWaypointToPassage(p.id, wp.id);
      }
    }
    await loadDetail(p.id);
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(t('passage.deleteTitle'), name, [
      { text: t('common.dismiss'), style: 'cancel' },
      {
        text: t('passage.delete'),
        style: 'destructive',
        onPress: () => {
          void deletePassage(id);
          if (selectedId === id) {
            setSelectedId(null);
            setDetail(null);
          }
        },
      },
    ]);
  }

  async function refreshDetail(passageId: string) {
    await loadDetail(passageId);
  }

  async function handleAddWaypoint(passageId: string, waypointId: string) {
    await addWaypointToPassage(passageId, waypointId);
    await refreshDetail(passageId);
  }

  async function handleRemoveWaypoint(passageId: string, waypointId: string) {
    await removeWaypointFromPassage(passageId, waypointId);
    await refreshDetail(passageId);
  }

  async function handleMoveUp(index: number) {
    if (!detail) return;
    await reorderWaypointInPassage(detail.id, index, index - 1);
    await refreshDetail(detail.id);
  }

  async function handleMoveDown(index: number) {
    if (!detail) return;
    await reorderWaypointInPassage(detail.id, index, index + 1);
    await refreshDetail(detail.id);
  }

  async function handleMetaName(name: string) {
    if (!detail) return;
    await setPassageMeta(detail.id, { name });
    await refreshDetail(detail.id);
  }

  async function handleMetaSog(sogKn: number) {
    if (!detail) return;
    await setPassageMeta(detail.id, { default_sog_kn: sogKn });
    await refreshDetail(detail.id);
  }

  async function handleDepartureNow() {
    if (!detail) return;
    await setPassageMeta(detail.id, { planned_departure: Date.now() });
    await refreshDetail(detail.id);
  }

  async function handleClearDeparture() {
    if (!detail) return;
    await setPassageMeta(detail.id, { planned_departure: null });
    await refreshDetail(detail.id);
  }

  async function handleLegSogChange(leg: PassageLeg, sogKn: number) {
    if (!detail) return;
    await setLegOverride(detail.id, leg.from.id, leg.to.id, { sogKn });
    await refreshDetail(detail.id);
  }

  async function handleLegNoteChange(leg: PassageLeg, note: string) {
    if (!detail) return;
    await setLegOverride(detail.id, leg.from.id, leg.to.id, { note });
    await refreshDetail(detail.id);
  }

  async function handleCopySummary() {
    if (!detail) return;
    const text = await buildPassageSummary(detail.id);
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showInfo(t('passage.summaryCopied'));
  }

  if (passages.length === 0) {
    return (
      <Screen testID="screen.passage" title={t('tabs.passage')}>
        <EmptyState
          testID="passage.empty"
          icon="route"
          title={t('passage.emptyTitle')}
          body={t('passage.emptyBody')}
          actionLabel={t('passage.create')}
          onAction={() => void handleCreate()}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="screen.passage" title={t('tabs.passage')} subtitle={t('passage.subtitle')}>
      <Button label={t('passage.create')} onPress={() => void handleCreate()} testID="passage.create" />
      <FlatList
        data={passages}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        style={{ marginTop: spacing.lg }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.md }]}>
            <Pressable onPress={() => void loadDetail(item.id)} accessibilityRole="button" style={{ minHeight: 48 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              {item.id === activePassageId ? <StatusBadge label={t('passage.active')} variant="success" /> : null}
            </Pressable>
            <View style={styles.actions}>
              <Button label={t('passage.view')} variant="secondary" onPress={() => void loadDetail(item.id)} testID={`passage.view.${item.id}`} />
              {item.id === activePassageId ? (
                <Button label={t('passage.deactivate')} variant="secondary" onPress={() => void deactivatePassage()} testID="passage.deactivate" />
              ) : (
                <Button label={t('passage.activate')} onPress={() => void activatePassage(item.id).then(() => navigation.navigate('Map'))} testID={`passage.activate.${item.id}`} />
              )}
              <Button label={t('passage.delete')} variant="danger" onPress={() => confirmDelete(item.id, item.name)} testID={`passage.delete.${item.id}`} />
            </View>
          </View>
        )}
      />

      {detail ? (
        <>
          <PassageMetaSection
            detail={detail}
            onNameChange={(name) => void handleMetaName(name)}
            onDefaultSogChange={(sog) => void handleMetaSog(sog)}
            onDepartureNow={() => void handleDepartureNow()}
            onClearDeparture={() => void handleClearDeparture()}
          />
          <PassageWaypointSection
            detail={detail}
            allWaypoints={waypoints}
            onAdd={(wpId) => void handleAddWaypoint(detail.id, wpId)}
            onRemove={(wpId) => void handleRemoveWaypoint(detail.id, wpId)}
            onMoveUp={(index) => void handleMoveUp(index)}
            onMoveDown={(index) => void handleMoveDown(index)}
          />
          <PassageCoverageCard detail={detail} onOpenDownloads={() => navigation.navigate('Downloads')} />
          <PassageEditorPanel
            detail={detail}
            legCoverage={coverage.legs}
            editorPane={editorPane}
            onEditorPaneChange={setEditorPane}
            highlightedLegIndex={highlightedLegIndex}
            onHighlightLeg={setHighlightedLegIndex}
            onLegSogChange={(leg, sog) => void handleLegSogChange(leg, sog)}
            onLegNoteChange={(leg, note) => void handleLegNoteChange(leg, note)}
          />
          <View style={[styles.exportRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <Button label={t('passage.exportGpx')} variant="secondary" onPress={() => void exportPassageGpx(detail.id)} testID="passage.exportGpx" />
            <Button label={t('passage.copySummary')} variant="secondary" onPress={() => void handleCopySummary()} testID="passage.copySummary" />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  name: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  actions: { gap: 8, marginTop: 8 },
  exportRow: { gap: 8 },
});
