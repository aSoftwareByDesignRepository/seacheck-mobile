import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PassageCoverageCard } from '../../features/passage/PassageCoverageCard';
import { PassageMetaSection } from '../../features/passage/PassageMetaSection';
import { PassageWaypointSection } from '../../features/passage/PassageWaypointSection';
import { PassageWaypointCoordSheet } from '../../features/passage/PassageWaypointCoordSheet';
import {
  addMapWaypointToPassage,
  notifyPassagePlanningChanged,
  startPassageMapPlanning,
  startPassageMapView,
} from '../../lib/passage/passageMapPlanning';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { useFormFactor } from '../../hooks/useFormFactor';
import { t } from '../../i18n';
import type { PassageStackParamList } from '../../navigation/PassageStack';
import type { RootTabParamList } from '../../navigation/types';
import type { PassageWithLegs } from '../../store/passageStore';
import { usePassageStore } from '../../store/passageStore';
import type { WaypointRow } from '../../lib/db/database';
import { requestConfirm } from '../../store/confirmStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type DetailRoute = RouteProp<PassageStackParamList, 'PassageDetail'>;
type TabNav = BottomTabNavigationProp<RootTabParamList>;
type StackNav = NativeStackNavigationProp<PassageStackParamList, 'PassageDetail'>;

export function PassageDetailScreen() {
  const route = useRoute<DetailRoute>();
  const stackNav = useNavigation<StackNav>();
  const tabNav = useNavigation<TabNav>();
  const { spacing, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const compactActions = formFactor === 'compact';
  const passageId = route.params.passageId;

  const activePassageId = usePassageStore((s) => s.activePassageId);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const duplicatePassage = usePassageStore((s) => s.duplicatePassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const deactivatePassage = usePassageStore((s) => s.deactivatePassage);
  const removeWaypointFromPassage = usePassageStore((s) => s.removeWaypointFromPassage);
  const reorderWaypointInPassage = usePassageStore((s) => s.reorderWaypointInPassage);
  const setPassageMeta = usePassageStore((s) => s.setPassageMeta);
  const exportPassageGpx = usePassageStore((s) => s.exportPassageGpx);
  const buildPassageSummary = usePassageStore((s) => s.buildPassageSummary);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const updateWaypoint = useWaypointStore((s) => s.update);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const planningPassageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);

  const [detail, setDetail] = useState<PassageWithLegs | null>(null);
  const [coordSheet, setCoordSheet] = useState<{ mode: 'add' | 'edit'; waypoint?: WaypointRow } | null>(null);

  const loadDetail = useCallback(async () => {
    const d = await getPassageDetail(passageId);
    setDetail(d);
    if (d) {
      stackNav.setOptions({ title: d.name });
    }
  }, [getPassageDetail, passageId, stackNav]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, passageId]);

  useEffect(() => {
    if (planningPassageId !== passageId) return;
    void loadDetail();
  }, [planningRevision, planningPassageId, passageId, loadDetail]);

  async function handleDuplicate() {
    const copy = await duplicatePassage(passageId);
    showInfo(t('passage.duplicated'));
    stackNav.replace('PassageDetail', { passageId: copy.id });
  }

  async function confirmDelete() {
    if (!detail) return;
    const ok = await requestConfirm({
      title: t('passage.deleteTitle'),
      message: detail.name,
      confirmLabel: t('passage.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deletePassage(passageId);
    stackNav.navigate('PassageList');
  }

  async function handleMetaName(name: string) {
    await setPassageMeta(passageId, { name });
    await loadDetail();
    showInfo(t('passage.nameSaved'));
  }

  async function handleMetaSog(sogKn: number) {
    await setPassageMeta(passageId, { default_sog_kn: sogKn });
    await loadDetail();
  }

  async function handleCopySummary() {
    const text = await buildPassageSummary(passageId);
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showInfo(t('passage.summaryCopied'));
  }

  function handlePlanOnMap() {
    void startPassageMapPlanning(passageId).then((started) => {
      if (started) tabNav.navigate('Map');
    });
  }

  function handleShowOnMap() {
    if (!detail || detail.waypoints.length === 0) return;
    void startPassageMapView(passageId).then((started) => {
      if (started) tabNav.navigate('Map');
    });
  }

  async function handleCoordSubmit(input: { name: string; latitude: number; longitude: number }) {
    if (!detail) return;
    if (coordSheet?.mode === 'edit' && coordSheet.waypoint) {
      await updateWaypoint(coordSheet.waypoint.id, input);
      notifyPassagePlanningChanged(passageId);
    } else {
      await addMapWaypointToPassage(passageId, input.latitude, input.longitude, input.name);
    }
    await loadDetail();
  }

  if (!detail) {
    return <View style={styles.loading} testID="passage.detail.loading" />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.scroll, { padding: spacing.lg, gap: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        testID="passage.detail"
      >
        <PassageMetaSection
          detail={detail}
          onNameChange={(name) => void handleMetaName(name)}
          onDefaultSogChange={(sog) => void handleMetaSog(sog)}
        />
        <PassageWaypointSection
          detail={detail}
          onRemove={(wpId) => {
            void removeWaypointFromPassage(passageId, wpId).then(() => {
              notifyPassagePlanningChanged(passageId);
              void loadDetail();
            });
          }}
          onMoveUp={(index) => {
            void reorderWaypointInPassage(passageId, index, index - 1).then(() => {
              notifyPassagePlanningChanged(passageId);
              void loadDetail();
            });
          }}
          onMoveDown={(index) => {
            void reorderWaypointInPassage(passageId, index, index + 1).then(() => {
              notifyPassagePlanningChanged(passageId);
              void loadDetail();
            });
          }}
          onPlanOnMap={handlePlanOnMap}
          onShowOnMap={handleShowOnMap}
          onAddByCoords={() => setCoordSheet({ mode: 'add' })}
          onEditWaypoint={(wp) => setCoordSheet({ mode: 'edit', waypoint: wp })}
        />
        <PassageCoverageCard
          detail={detail}
          onOpenDownloads={(opts) => tabNav.navigate('Downloads', opts)}
        />
        <View
          style={[
            styles.actions,
            !compactActions ? styles.actionsRow : null,
            { gap: spacing.sm, minHeight: minTouch },
          ]}
        >
          {detail.id === activePassageId ? (
            <Button
              label={t('passage.deactivate')}
              variant="secondary"
              fullWidth={compactActions}
              onPress={() => void deactivatePassage()}
              testID="passage.detail.deactivate"
            />
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
                  .then(() => tabNav.navigate('Map'))
                  .catch(() => showError(t('passage.activateFailed')));
              }}
              testID="passage.detail.activate"
            />
          )}
          <Button
            label={t('passage.exportGpx')}
            variant="secondary"
            fullWidth={compactActions}
            onPress={() => void exportPassageGpx(detail.id)}
            testID="passage.exportGpx"
          />
          <Button
            label={t('passage.copySummary')}
            variant="secondary"
            fullWidth={compactActions}
            onPress={() => void handleCopySummary()}
            testID="passage.copySummary"
          />
          <Button
            label={t('passage.duplicate')}
            variant="secondary"
            fullWidth={compactActions}
            onPress={() => void handleDuplicate()}
            testID="passage.detail.duplicate"
          />
          <Button
            label={t('passage.delete')}
            variant="danger"
            fullWidth={compactActions}
            onPress={() => void confirmDelete()}
            testID="passage.detail.delete"
          />
        </View>
      </ScrollView>
      <PassageWaypointCoordSheet
        visible={coordSheet != null}
        mode={coordSheet?.mode ?? 'add'}
        waypoint={coordSheet?.waypoint}
        onClose={() => setCoordSheet(null)}
        onSubmit={handleCoordSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  loading: { flex: 1 },
  actions: { marginTop: 4 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
