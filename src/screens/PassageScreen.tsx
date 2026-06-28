import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PassageCoverageCard } from '../features/passage/PassageCoverageCard';
import { PassageEditorPanel } from '../features/passage/PassageEditorPanel';
import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { PassageMetaSection } from '../features/passage/PassageMetaSection';
import { PassageWaypointSection } from '../features/passage/PassageWaypointSection';
import { PassageWaypointCoordSheet } from '../features/passage/PassageWaypointCoordSheet';
import { addMapWaypointToPassage, notifyPassagePlanningChanged, startPassageMapPlanning } from '../lib/passage/passageMapPlanning';
import { usePassageMapPlanningStore } from '../store/passageMapPlanningStore';
import { usePassageCoverage } from '../hooks/usePassageCoverage';
import { useFormFactor } from '../hooks/useFormFactor';
import { formatDistanceNm, distanceUnitLabel } from '../lib/geo/units';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import type { PassageLeg, PassageWithLegs } from '../store/passageStore';
import { usePassageStore } from '../store/passageStore';
import type { WaypointRow } from '../lib/db/database';
import { requestConfirm } from '../store/confirmStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useWaypointStore } from '../store/waypointStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { SelectHint } from '../ui/SelectHint';
import { StatusBadge } from '../ui/StatusBadge';

export function PassageScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing } = useTheme();
  const { formFactor } = useFormFactor();
  const listColumns = formFactor !== 'compact' ? 2 : 1;
  const compactActions = formFactor === 'compact';
  const passages = usePassageStore((s) => s.passages);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const createPassage = usePassageStore((s) => s.createPassage);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const duplicatePassage = usePassageStore((s) => s.duplicatePassage);
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
  const updateWaypoint = useWaypointStore((s) => s.update);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PassageWithLegs | null>(null);
  const [editorPane, setEditorPane] = useState<'table' | 'map'>('table');
  const [highlightedLegIndex, setHighlightedLegIndex] = useState<number | null>(null);
  const [coordSheet, setCoordSheet] = useState<{ mode: 'add' | 'edit'; waypoint?: WaypointRow } | null>(null);
  const [summaries, setSummaries] = useState<Record<string, { legs: number; nm: number; waypoints: number }>>({});
  const coverage = usePassageCoverage(detail?.waypoints ?? []);
  const planningPassageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);

  const loadDetail = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetail(await getPassageDetail(id));
    },
    [getPassageDetail],
  );

  useEffect(() => {
    void Promise.all(
      passages.map(async (p) => {
        const d = await getPassageDetail(p.id);
        return { id: p.id, legs: d?.legs.length ?? 0, nm: d?.totalNm ?? 0, waypoints: d?.waypoints.length ?? 0 };
      }),
    ).then((rows) => {
      const map: Record<string, { legs: number; nm: number; waypoints: number }> = {};
      for (const r of rows) map[r.id] = { legs: r.legs, nm: r.nm, waypoints: r.waypoints };
      setSummaries(map);
    });
  }, [passages, getPassageDetail]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [passages, selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId || planningPassageId !== selectedId) return;
    void loadDetail(selectedId);
  }, [planningRevision, selectedId, planningPassageId, loadDetail]);

  useEffect(() => {
    if (!planningPassageId) return;
    void getPassageDetail(planningPassageId).then((d) => {
      if (!d) return;
      setSummaries((prev) => ({
        ...prev,
        [planningPassageId]: { legs: d.legs.length, nm: d.totalNm, waypoints: d.waypoints.length },
      }));
    });
  }, [planningRevision, planningPassageId, getPassageDetail]);

  async function handleDuplicate(id: string) {
    const copy = await duplicatePassage(id);
    await loadDetail(copy.id);
    showInfo(t('passage.duplicated'));
  }

  async function handleCreate() {
    const p = await createPassage(t('passage.defaultName'));
    await loadDetail(p.id);
  }

  async function confirmDelete(id: string, name: string) {
    const ok = await requestConfirm({
      title: t('passage.deleteTitle'),
      message: name,
      confirmLabel: t('passage.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deletePassage(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    }
  }

  async function refreshDetail(passageId: string) {
    await loadDetail(passageId);
  }

  async function handleAddWaypoint(passageId: string, waypointId: string) {
    await addWaypointToPassage(passageId, waypointId);
    notifyPassagePlanningChanged(passageId);
    await refreshDetail(passageId);
  }

  async function handleRemoveWaypoint(passageId: string, waypointId: string) {
    await removeWaypointFromPassage(passageId, waypointId);
    notifyPassagePlanningChanged(passageId);
    await refreshDetail(passageId);
  }

  async function handleMoveUp(index: number) {
    if (!detail) return;
    await reorderWaypointInPassage(detail.id, index, index - 1);
    notifyPassagePlanningChanged(detail.id);
    await refreshDetail(detail.id);
  }

  async function handleMoveDown(index: number) {
    if (!detail) return;
    await reorderWaypointInPassage(detail.id, index, index + 1);
    notifyPassagePlanningChanged(detail.id);
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

  async function handleDepartureChange(utcMs: number | null) {
    if (!detail) return;
    await setPassageMeta(detail.id, { planned_departure: utcMs });
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

  function handlePlanOnMap() {
    if (!detail) return;
    void startPassageMapPlanning(detail.id).then((started) => {
      if (started) navigation.navigate('Map');
    });
  }

  async function handleCoordSubmit(input: { name: string; latitude: number; longitude: number }) {
    if (!detail) return;
    if (coordSheet?.mode === 'edit' && coordSheet.waypoint) {
      await updateWaypoint(coordSheet.waypoint.id, input);
      notifyPassagePlanningChanged(detail.id);
    } else {
      await addMapWaypointToPassage(detail.id, input.latitude, input.longitude, input.name);
    }
    await refreshDetail(detail.id);
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

  const listPane = (
    <FlatList
      data={passages}
      key={listColumns}
      numColumns={listColumns}
      keyExtractor={(p) => p.id}
      scrollEnabled={false}
      columnWrapperStyle={listColumns > 1 ? styles.gridRow : undefined}
      renderItem={({ item }) => {
        const meta = summaries[item.id];
        return (
          <View style={[styles.card, listColumns > 1 ? styles.gridCard : null, { backgroundColor: colors.surface, borderColor: selectedId === item.id ? colors.primary : colors.border, marginBottom: spacing.md }]}>
            <Pressable onPress={() => void loadDetail(item.id)} accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: selectedId === item.id }} style={{ minHeight: 48 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              {meta ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('passage.listMeta', {
                    legs: meta.legs,
                    distance: formatDistanceNm(meta.nm, distanceUnit),
                    unit: distanceUnitLabel(distanceUnit),
                  })}
                </Text>
              ) : null}
              {item.id === activePassageId ? <StatusBadge label={t('passage.active')} variant="success" /> : null}
            </Pressable>
            <View style={[styles.actions, !compactActions ? styles.actionsRow : null]}>
              {item.id === activePassageId ? (
                <Button label={t('passage.deactivate')} variant="secondary" fullWidth={compactActions} onPress={() => void deactivatePassage()} testID="passage.deactivate" />
              ) : (
                <Button
                  label={t('passage.activate')}
                  disabled={!meta || meta.waypoints < 2}
                  fullWidth={compactActions}
                  onPress={() => {
                    if (!meta || meta.waypoints < 2) {
                      showError(t('passage.activateNeedTwo'));
                      return;
                    }
                    void activatePassage(item.id)
                      .then(() => navigation.navigate('Map'))
                      .catch(() => showError(t('passage.activateNeedTwo')));
                  }}
                  testID={`passage.activate.${item.id}`}
                />
              )}
              <Button label={t('passage.duplicate')} variant="secondary" fullWidth={compactActions} onPress={() => void handleDuplicate(item.id)} testID={`passage.duplicate.${item.id}`} />
              <Button label={t('passage.delete')} variant="danger" fullWidth={compactActions} onPress={() => confirmDelete(item.id, item.name)} testID={`passage.delete.${item.id}`} />
            </View>
          </View>
        );
      }}
    />
  );

  const detailPane = detail ? (
    <>
      <PassageMetaSection
        detail={detail}
        onNameChange={(name) => void handleMetaName(name)}
        onDefaultSogChange={(sog) => void handleMetaSog(sog)}
        onDepartureNow={() => void handleDepartureNow()}
        onDepartureChange={(ms) => void handleDepartureChange(ms)}
        onClearDeparture={() => void handleClearDeparture()}
      />
      <PassageWaypointSection
        detail={detail}
        allWaypoints={waypoints}
        onAdd={(wpId) => void handleAddWaypoint(detail.id, wpId)}
        onRemove={(wpId) => void handleRemoveWaypoint(detail.id, wpId)}
        onMoveUp={(index) => void handleMoveUp(index)}
        onMoveDown={(index) => void handleMoveDown(index)}
        onPlanOnMap={handlePlanOnMap}
        onAddByCoords={() => setCoordSheet({ mode: 'add' })}
        onEditWaypoint={(wp) => setCoordSheet({ mode: 'edit', waypoint: wp })}
      />
      <PassageCoverageCard
        detail={detail}
        onOpenDownloads={(opts) => navigation.navigate('Downloads', opts)}
      />
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
      <View style={[styles.exportRow, !compactActions ? styles.actionsRow : null, { marginTop: spacing.lg, gap: spacing.sm }]}>
        {detail.id === activePassageId ? (
          <Button label={t('passage.deactivate')} variant="secondary" fullWidth={compactActions} onPress={() => void deactivatePassage()} testID="passage.detail.deactivate" />
        ) : (
          <Button
            label={t('passage.activate')}
            disabled={detail.waypoints.length < 2}
            fullWidth={compactActions}
            onPress={() => {
              if (detail.waypoints.length < 2) {
                showError(t('passage.activateNeedTwo'));
                return;
              }
              void activatePassage(detail.id)
                .then(() => navigation.navigate('Map'))
                .catch(() => showError(t('passage.activateFailed')));
            }}
            testID="passage.detail.activate"
          />
        )}
        <Button label={t('passage.exportGpx')} variant="secondary" fullWidth={compactActions} onPress={() => void exportPassageGpx(detail.id)} testID="passage.exportGpx" />
        <Button label={t('passage.copySummary')} variant="secondary" fullWidth={compactActions} onPress={() => void handleCopySummary()} testID="passage.copySummary" />
      </View>
    </>
  ) : (
    <SelectHint testID="passage.selectHint">{t('passage.selectHint')}</SelectHint>
  );

  return (
    <Screen testID="screen.passage" title={t('tabs.passage')} subtitle={t('passage.subtitle')}>
      <Button label={t('passage.create')} onPress={() => void handleCreate()} testID="passage.create" />
      <View style={{ marginTop: spacing.lg }}>
        <MasterDetailLayout master={listPane} detail={detailPane} />
      </View>
      <PassageWaypointCoordSheet
        visible={coordSheet != null}
        mode={coordSheet?.mode ?? 'add'}
        waypoint={coordSheet?.waypoint}
        onClose={() => setCoordSheet(null)}
        onSubmit={handleCoordSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  gridRow: { gap: 12 },
  gridCard: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  actions: { gap: 8, marginTop: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  exportRow: { gap: 8 },
});
