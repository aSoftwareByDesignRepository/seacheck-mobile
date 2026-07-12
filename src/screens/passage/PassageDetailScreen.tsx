import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { PassageCoverageCard } from '../../features/passage/PassageCoverageCard';
import { PassageEditorLayout } from '../../features/passage/PassageEditorLayout';
import { PassageMapPreviewPanel } from '../../features/passage/PassageMapPreviewPanel';
import { PassageMetaSection } from '../../features/passage/PassageMetaSection';
import { PassageWaypointSection } from '../../features/passage/PassageWaypointSection';
import { PassageWaypointCoordSheet } from '../../features/passage/PassageWaypointCoordSheet';
import { confirmReverseActivePassage } from '../../lib/passage/confirmReversePassage';
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
import { PassageDeactivateButton } from '../../features/passage/PassageDeactivateButton';
import type { PassageWithLegs } from '../../store/passageStore';
import { usePassageStore } from '../../store/passageStore';
import type { WaypointRow } from '../../lib/db/database';
import { requestConfirm } from '../../store/confirmStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack } from '../../ui/Screen';
import { EmptyState } from '../../ui/EmptyState';

type DetailRoute = RouteProp<PassageStackParamList, 'PassageDetail'>;
type TabNav = BottomTabNavigationProp<RootTabParamList>;
type StackNav = NativeStackNavigationProp<PassageStackParamList, 'PassageDetail'>;

export function PassageDetailScreen() {
  const route = useRoute<DetailRoute>();
  const stackNav = useNavigation<StackNav>();
  const tabNav = useNavigation<TabNav>();
  const { colors, spacing, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const compactActions = formFactor === 'compact';
  const passageId = route.params.passageId;

  const activePassageId = usePassageStore((s) => s.activePassageId);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const duplicatePassage = usePassageStore((s) => s.duplicatePassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const removeWaypointFromPassage = usePassageStore((s) => s.removeWaypointFromPassage);
  const reorderWaypointInPassage = usePassageStore((s) => s.reorderWaypointInPassage);
  const reversePassageWaypoints = usePassageStore((s) => s.reversePassageWaypoints);
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'failed' | 'missing' | null>(null);
  const [coordSheet, setCoordSheet] = useState<{ mode: 'add' | 'edit'; waypoint?: WaypointRow } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshDetail = useCallback(async () => {
    try {
      const d = await getPassageDetail(passageId);
      if (!mountedRef.current) return d;
      setDetail(d);
      setLoadError(d ? null : 'missing');
      if (d) {
        stackNav.setOptions({ title: d.name });
      }
      return d;
    } catch {
      if (mountedRef.current) {
        setDetail(null);
        setLoadError('failed');
      }
      return null;
    }
  }, [getPassageDetail, passageId, stackNav]);

  const loadPassage = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setLoadError(null);
    await refreshDetail();
    if (mountedRef.current) setLoading(false);
  }, [refreshDetail]);

  useEffect(() => {
    void loadPassage();
  }, [loadPassage, passageId]);

  useEffect(() => {
    if (planningPassageId !== passageId) return;
    void refreshDetail();
  }, [planningRevision, planningPassageId, passageId, refreshDetail]);

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
    await refreshDetail();
    showInfo(t('passage.nameSaved'));
  }

  async function handleMetaSog(sogKn: number) {
    await setPassageMeta(passageId, { default_sog_kn: sogKn });
    await refreshDetail();
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
    await refreshDetail();
  }

  if (loading && !detail) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]} testID="passage.detail.loading">
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  if (loadError || !detail) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]} testID="passage.detail.error">
        <EmptyState
          icon={loadError === 'missing' ? 'route' : 'error-outline'}
          title={loadError === 'missing' ? t('passage.detailNotFound') : t('passage.detailLoadFailed')}
          body={loadError === 'missing' ? '' : t('passage.detailLoadFailedBody')}
          actionLabel={loadError === 'missing' ? t('common.back') : t('common.retry')}
          onAction={() => {
            if (loadError === 'missing') {
              stackNav.navigate('PassageList');
              return;
            }
            void loadPassage();
          }}
          testID="passage.detail.errorState"
        />
      </View>
    );
  }

  const showMapPreview = detail.waypoints.length >= 1;

  const editorPane = (
    <View style={{ gap: spacing.lg }}>
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
            void refreshDetail();
          });
        }}
        onMoveUp={(index) => {
          void reorderWaypointInPassage(passageId, index, index - 1).then(() => {
            notifyPassagePlanningChanged(passageId);
            void refreshDetail();
          });
        }}
        onMoveDown={(index) => {
          void reorderWaypointInPassage(passageId, index, index + 1).then(() => {
            notifyPassagePlanningChanged(passageId);
            void refreshDetail();
          });
        }}
        onPlanOnMap={handlePlanOnMap}
        onShowOnMap={handleShowOnMap}
        onAddByCoords={() => setCoordSheet({ mode: 'add' })}
        onEditWaypoint={(wp) => setCoordSheet({ mode: 'edit', waypoint: wp })}
        onReverse={() => {
          void (async () => {
            if (passageId === activePassageId) {
              const ok = await confirmReverseActivePassage();
              if (!ok) return;
            }
            try {
              await reversePassageWaypoints(passageId);
              await refreshDetail();
              showInfo(t('passage.reverseSuccess'));
            } catch {
              showError(t('passage.reverseFailed'));
            }
          })();
        }}
        showMapHandoffButtons={formFactor === 'compact'}
      />
      <PassageCoverageCard detail={detail} onOpenDownloads={(opts) => tabNav.navigate('Downloads', opts)} />
      <View
        style={[
          styles.actions,
          !compactActions ? styles.actionsRow : null,
          { gap: spacing.sm, minHeight: minTouch },
        ]}
      >
        {compactActions ? (
          <ButtonStack>
            {detail.id === activePassageId ? (
              <PassageDeactivateButton variant="panel" testID="passage.detail.deactivate" />
            ) : (
              <Button
                label={t('passage.activate')}
                disabled={detail.waypoints.length < 2}
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
              onPress={() => void exportPassageGpx(detail.id)}
              testID="passage.exportGpx"
            />
            <Button
              label={t('passage.copySummary')}
              variant="secondary"
              onPress={() => void handleCopySummary()}
              testID="passage.copySummary"
            />
            <Button
              label={t('passage.duplicate')}
              variant="secondary"
              onPress={() => void handleDuplicate()}
              testID="passage.detail.duplicate"
            />
            <Button
              label={t('passage.delete')}
              variant="danger"
              onPress={() => void confirmDelete()}
              testID="passage.detail.delete"
            />
          </ButtonStack>
        ) : (
          <>
            {detail.id === activePassageId ? (
              <PassageDeactivateButton variant="panel" fullWidth={false} style={styles.actionBtn} testID="passage.detail.deactivate" />
            ) : (
              <Button
                label={t('passage.activate')}
                disabled={detail.waypoints.length < 2}
                fullWidth={false}
                style={styles.actionBtn}
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
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => void exportPassageGpx(detail.id)}
              testID="passage.exportGpx"
            />
            <Button
              label={t('passage.copySummary')}
              variant="secondary"
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => void handleCopySummary()}
              testID="passage.copySummary"
            />
            <Button
              label={t('passage.duplicate')}
              variant="secondary"
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => void handleDuplicate()}
              testID="passage.detail.duplicate"
            />
            <Button
              label={t('passage.delete')}
              variant="danger"
              fullWidth={false}
              style={styles.actionBtn}
              onPress={() => void confirmDelete()}
              testID="passage.detail.delete"
            />
          </>
        )}
      </View>
    </View>
  );

  const mapPreviewPane = showMapPreview ? (
    <PassageMapPreviewPanel
      waypoints={detail.waypoints}
      onPlanOnMap={handlePlanOnMap}
      onShowOnMap={handleShowOnMap}
    />
  ) : null;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.scroll, { padding: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        testID="passage.detail"
      >
        <PassageEditorLayout editor={editorPane} mapPreview={mapPreviewPane} />
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
  centered: { flex: 1, justifyContent: 'center' },
  actions: { marginTop: 4 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 140 },
});
