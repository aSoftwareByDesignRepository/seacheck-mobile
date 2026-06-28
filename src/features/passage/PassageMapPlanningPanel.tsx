import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { addMapWaypointToPassage, notifyPassagePlanningChanged, stopPassageMapPlanning } from '../../lib/passage/passageMapPlanning';
import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import type { RootTabParamList } from '../../navigation/types';
import { requestConfirm } from '../../store/confirmStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore, type PassageWithLegs } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { PassageWaypointCoordSheet } from './PassageWaypointCoordSheet';

export function PassageMapPlanningPanel() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const mapBottom = useMapBottomLayout({ showSideActions: true });
  const insets = useSafeAreaInsets();
  const passageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);
  const passages = usePassageStore((s) => s.passages);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const removeWaypointFromPassage = usePassageStore((s) => s.removeWaypointFromPassage);
  const reorderWaypointInPassage = usePassageStore((s) => s.reorderWaypointInPassage);
  const updateWaypoint = useWaypointStore((s) => s.update);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [detail, setDetail] = useState<PassageWithLegs | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [coordSheet, setCoordSheet] = useState<{ mode: 'add' | 'edit'; waypoint?: WaypointRow } | null>(null);

  const refresh = useCallback(async () => {
    if (!passageId) {
      setDetail(null);
      return;
    }
    setDetail(await getPassageDetail(passageId));
  }, [passageId, getPassageDetail]);

  useEffect(() => {
    void refresh();
  }, [refresh, passages, planningRevision]);

  if (!passageId) return null;

  const passage = passages.find((p) => p.id === passageId);
  const wpCount = detail?.waypoints.length ?? 0;
  const canActivate = wpCount >= 2;
  const unitLabel = distanceUnitLabel(distanceUnit);
  const totalNm = detail?.totalNm ?? 0;
  const metaA11y = t('passage.mapPlanningMeta', {
    count: wpCount,
    distance: formatDistanceNm(totalNm, distanceUnit),
    unit: unitLabel,
  });

  async function handleDone() {
    stopPassageMapPlanning();
    showInfo(t('passage.mapPlanningSaved'));
    navigation.navigate('Passage');
  }

  async function handleStopPlanning() {
    if (wpCount === 0) {
      const ok = await requestConfirm({
        title: t('passage.mapPlanningDiscardTitle'),
        message: t('passage.mapPlanningDiscardEmpty'),
        confirmLabel: t('passage.mapPlanningDiscardConfirm'),
        destructive: true,
      });
      if (!ok) return;
      try {
        await deletePassage(passageId!);
      } catch {
        showError(t('passage.deleteFailed'));
        return;
      }
    }
    stopPassageMapPlanning();
    if (wpCount > 0) {
      showInfo(t('passage.mapPlanningStopped'));
    }
  }

  async function handleActivate() {
    if (!canActivate) {
      showError(t('passage.needTwoWaypoints'));
      return;
    }
    setBusy(true);
    try {
      await activatePassage(passageId!);
      stopPassageMapPlanning();
      showInfo(t('passage.activated'));
    } catch {
      showError(t('passage.activateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePassage() {
    const ok = await requestConfirm({
      title: t('passage.deleteTitle'),
      message: passage?.name ?? '',
      confirmLabel: t('passage.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePassage(passageId!);
      stopPassageMapPlanning();
    } catch {
      showError(t('passage.deleteFailed'));
    }
  }

  async function mutateWaypoints(action: () => Promise<void>) {
    try {
      await action();
      notifyPassagePlanningChanged(passageId!);
      await refresh();
    } catch {
      showError(t('passage.coordsSaveFailed'));
    }
  }

  async function handleCoordSubmit(input: { name: string; latitude: number; longitude: number }) {
    try {
      if (coordSheet?.mode === 'edit' && coordSheet.waypoint) {
        await updateWaypoint(coordSheet.waypoint.id, input);
        notifyPassagePlanningChanged(passageId!);
      } else {
        await addMapWaypointToPassage(passageId!, input.latitude, input.longitude, input.name);
      }
      await refresh();
    } catch {
      showError(t('passage.coordsSaveFailed'));
    }
  }

  const stepHint =
    wpCount === 0
      ? t('passage.mapPlanningEmpty')
      : wpCount === 1
        ? t('passage.mapPlanningNeedSecond')
        : t('passage.mapPlanningTapHint');

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingRight: mapBottom.actionColumnWidth + 12 }]}
        testID="passage.mapPlanning.panel"
      >
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary, gap: spacing.md, padding: spacing.lg }]}
          accessibilityViewIsModal
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {passage?.name ?? t('passage.defaultName')}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{stepHint}</Text>
          <View
            style={[styles.metaRow, { backgroundColor: colors.background, borderColor: colors.border }]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={metaA11y}
          >
            <Text style={[styles.metaValue, { color: colors.text }]}>{metaA11y}</Text>
          </View>

          <View style={[styles.primaryActions, { gap: spacing.sm, minHeight: minTouch }]}>
            <Button
              label={t('passage.mapPlanningDone')}
              onPress={() => void handleDone()}
              testID="passage.mapPlanning.done"
              style={styles.actionBtn}
            />
            {canActivate ? (
              <Button
                label={t('passage.activate')}
                variant="secondary"
                onPress={() => void handleActivate()}
                loading={busy}
                testID="passage.mapPlanning.activate"
                style={styles.actionBtn}
              />
            ) : (
              <Button
                label={t('passage.addByCoords')}
                variant="secondary"
                onPress={() => setCoordSheet({ mode: 'add' })}
                testID="passage.mapPlanning.addCoords"
                style={styles.actionBtn}
              />
            )}
          </View>

          {wpCount > 0 ? (
            <>
              <Button
                label={expanded ? t('passage.mapPlanningHideList') : t('passage.mapPlanningShowList', { count: wpCount })}
                variant="ghost"
                onPress={() => setExpanded((v) => !v)}
                testID="passage.mapPlanning.toggleList"
                style={{ minHeight: minTouch }}
              />
              {expanded ? (
                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={[styles.list, { borderColor: colors.border }]}
                  nestedScrollEnabled
                  accessibilityLabel={t('passage.waypointsTitle')}
                >
                  {detail?.waypoints.map((wp, index) => (
                    <View key={wp.id} style={[styles.row, { borderColor: colors.border, minHeight: minTouch }]}>
                      <Text style={[styles.order, { color: colors.primary }]} accessibilityElementsHidden>
                        {index + 1}
                      </Text>
                      <View style={styles.rowMain}>
                        <Text style={[styles.wpName, { color: colors.text }]} numberOfLines={1}>
                          {wp.name}
                        </Text>
                      </View>
                      <View style={styles.rowActions}>
                        <Button
                          label={t('passage.editWaypoint')}
                          variant="secondary"
                          onPress={() => setCoordSheet({ mode: 'edit', waypoint: wp })}
                          testID={`passage.mapPlanning.edit.${wp.id}`}
                        />
                        <Button
                          label={t('passage.moveUp')}
                          variant="secondary"
                          onPress={() => void mutateWaypoints(() => reorderWaypointInPassage(passageId!, index, index - 1))}
                          disabled={index === 0}
                          testID={`passage.mapPlanning.up.${wp.id}`}
                        />
                        <Button
                          label={t('passage.moveDown')}
                          variant="secondary"
                          onPress={() => void mutateWaypoints(() => reorderWaypointInPassage(passageId!, index, index + 1))}
                          disabled={index === (detail?.waypoints.length ?? 0) - 1}
                          testID={`passage.mapPlanning.down.${wp.id}`}
                        />
                        <Button
                          label={t('passage.removeWaypoint')}
                          variant="danger"
                          onPress={() => void mutateWaypoints(() => removeWaypointFromPassage(passageId!, wp.id))}
                          testID={`passage.mapPlanning.remove.${wp.id}`}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {canActivate ? (
                <Button
                  label={t('passage.addByCoords')}
                  variant="ghost"
                  onPress={() => setCoordSheet({ mode: 'add' })}
                  testID="passage.mapPlanning.addCoordsSecondary"
                  style={{ minHeight: minTouch }}
                />
              ) : null}
            </>
          ) : null}

          <View style={[styles.footerActions, { gap: spacing.sm }]}>
            <Button
              label={t('passage.mapPlanningStop')}
              variant="ghost"
              onPress={() => void handleStopPlanning()}
              testID="passage.mapPlanning.stop"
              style={{ minHeight: minTouch }}
            />
            <Button
              label={t('passage.delete')}
              variant="danger"
              onPress={() => void handleDeletePassage()}
              testID="passage.mapPlanning.delete"
              style={{ minHeight: minTouch }}
            />
          </View>
        </View>
      </View>
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
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, elevation: 60, paddingHorizontal: 12 },
  card: { borderWidth: 2, borderRadius: 16 },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  hint: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  metaRow: { borderWidth: 1, borderRadius: 12, padding: 12 },
  metaValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 22 },
  primaryActions: { flexDirection: 'row', flexWrap: 'wrap' },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 140 },
  listScroll: { maxHeight: 200 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  order: { fontSize: 16, fontWeight: '800', width: 28, textAlign: 'center' },
  rowMain: { flex: 1, minWidth: 100 },
  wpName: { fontSize: 15, fontWeight: '600' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 140 },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
