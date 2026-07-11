import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatBearing, magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { bearingTrue, distanceNm } from '../../lib/geo/navigation';
import { formatDistanceNm } from '../../lib/geo/units';
import { notifyPassagePlanningChanged, removeMapWaypointFromPassage } from '../../lib/passage/passageMapPlanning';
import type { WaypointRow } from '../../lib/db/database';
import { t } from '../../i18n';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useNavigationStore, waypointToTarget } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/tokens';
import { BottomSheet, SheetDismissFooter } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { ConfirmPanel } from '../../ui/ConfirmPanel';
import { CoordinateBlock } from '../../ui/CoordinateBlock';
import { PassageWaypointCoordSheet } from '../passage/PassageWaypointCoordSheet';

type Props = {
  waypoint: WaypointRow | null;
  onClose: () => void;
  onCopied?: () => void;
  onDeleted?: () => void;
  /** When set, delete removes the mark from this passage route on the chart. */
  planningPassageId?: string | null;
  allowRouteEdits?: boolean;
  /** Planning mode: open the coordinate editor immediately after a chart tap. */
  autoOpenEdit?: boolean;
};

export function WaypointMapDetailSheet({
  waypoint,
  onClose,
  onCopied,
  onDeleted,
  planningPassageId = null,
  allowRouteEdits = true,
  autoOpenEdit = false,
}: Props) {
  const { colors, spacing } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const setGoTo = useNavigationStore((s) => s.setGoTo);
  const updateWaypoint = useWaypointStore((s) => s.update);
  const removeWaypoint = useWaypointStore((s) => s.remove);
  const showError = useFeedbackStore((s) => s.showError);

  const planningMode = planningPassageId != null;
  const planningEditable = planningMode && allowRouteEdits;

  useEffect(() => {
    if (!waypoint || !planningEditable || !autoOpenEdit) {
      setEditOpen(false);
      return;
    }
    setEditOpen(true);
  }, [waypoint?.id, planningEditable, autoOpenEdit]);

  if (!waypoint) return null;

  const posFix = fix && !isFixStale(fix) ? fix : lastGoodFix;
  const isGoTo = goToTarget?.id === waypoint.id && goToTarget.kind === 'waypoint';
  const typeLabel = t(`waypoints.types.${waypoint.type}` as 'waypoints.types.generic');
  const showDelete = !planningMode || planningEditable;
  const showGoTo = !planningMode && !isGoTo;

  let brgDist: string | null = null;
  if (posFix) {
    const declination = magneticDeclinationDeg(posFix.latitude, posFix.longitude);
    const brgFormatted = formatBearing(
      bearingTrue([posFix.longitude, posFix.latitude], [waypoint.longitude, waypoint.latitude]),
      bearingReference,
      declination,
    );
    const dist = formatDistanceNm(
      distanceNm([posFix.longitude, posFix.latitude], [waypoint.longitude, waypoint.latitude]),
      distanceUnit,
    );
    brgDist = t('map.waypointBrgDist', {
      brg: `${Math.round(brgFormatted.value)}° ${brgFormatted.suffix}`,
      dist,
      unit: distanceUnit,
    });
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      if (planningEditable) {
        await removeMapWaypointFromPassage(planningPassageId!, waypoint!.id);
      } else {
        await removeWaypoint(waypoint!.id);
      }
      onDeleted?.();
      onClose();
    } catch {
      showError(t('waypoints.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleEditSubmit(input: { name: string; latitude: number; longitude: number }) {
    if (!planningPassageId) return;
    await updateWaypoint(waypoint!.id, input);
    notifyPassagePlanningChanged(planningPassageId);
  }

  if (planningEditable && autoOpenEdit) {
    if (confirmDelete) {
      return (
        <BottomSheet visible onClose={() => setConfirmDelete(false)} title={t('waypoints.deleteTitle')} testID="waypointMap.deleteConfirmSheet">
          <ConfirmPanel
            title={t('waypoints.deleteTitle')}
            message={waypoint.name}
            confirmLabel={t('waypoints.delete')}
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmDelete(false)}
            testID="waypointMap.deleteConfirm"
          />
        </BottomSheet>
      );
    }
    return (
      <PassageWaypointCoordSheet
        visible
        mode="edit"
        waypoint={waypoint}
        onClose={onClose}
        onSubmit={handleEditSubmit}
        onDelete={() => setConfirmDelete(true)}
      />
    );
  }

  return (
    <>
      <BottomSheet visible onClose={onClose} title={waypoint.name} subtitle={typeLabel} testID="waypointMap.sheet">
        {confirmDelete ? (
          <ConfirmPanel
            title={t('waypoints.deleteTitle')}
            message={waypoint.name}
            confirmLabel={t('waypoints.delete')}
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmDelete(false)}
            testID="waypointMap.deleteConfirm"
          />
        ) : (
          <>
            {brgDist ? <Text style={[styles.meta, { color: colors.text }]}>{brgDist}</Text> : null}
            {isGoTo ? (
              <Text style={[styles.activeGoTo, { color: colors.success }]}>{t('map.waypointActiveGoTo')}</Text>
            ) : null}
            {planningEditable && !autoOpenEdit ? (
              <Text style={[styles.planningHint, { color: colors.textMuted }]}>{t('passage.mapPlanningWaypointHint')}</Text>
            ) : null}
            <CoordinateBlock latitude={waypoint.latitude} longitude={waypoint.longitude} onCopied={onCopied} />
            {waypoint.note?.trim() ? (
              <Text style={[styles.note, { color: colors.textMuted }]}>{waypoint.note.trim()}</Text>
            ) : null}
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {showGoTo ? (
                <Button
                  label={t('waypoints.goTo')}
                  onPress={() => void setGoTo(waypointToTarget(waypoint)).then(onClose)}
                  testID="waypointMap.goTo"
                />
              ) : null}
              {planningEditable ? (
                <Button
                  label={t('passage.editWaypoint')}
                  variant="secondary"
                  onPress={() => setEditOpen(true)}
                  testID="waypointMap.edit"
                />
              ) : null}
              {showDelete ? (
                <Button
                  label={t('waypoints.delete')}
                  variant="danger"
                  onPress={() => setConfirmDelete(true)}
                  testID="waypointMap.delete"
                />
              ) : null}
              <SheetDismissFooter onClose={onClose} testID="waypointMap.dismiss" />
            </View>
          </>
        )}
      </BottomSheet>

      {planningEditable ? (
        <PassageWaypointCoordSheet
          visible={editOpen}
          mode="edit"
          waypoint={waypoint}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, fontWeight: '700', marginTop: 4 },
  activeGoTo: { fontSize: 13, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  planningHint: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 8 },
  note: { ...typography.caption, lineHeight: 20, marginTop: 10 },
});
