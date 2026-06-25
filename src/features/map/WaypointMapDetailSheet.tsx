import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatBearing, magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { bearingTrue, distanceNm } from '../../lib/geo/navigation';
import { formatDistanceNm } from '../../lib/geo/units';
import type { WaypointRow } from '../../lib/db/database';
import { t } from '../../i18n';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useNavigationStore, waypointToTarget } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/tokens';
import { BottomSheet, SheetDismissFooter } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { ConfirmPanel } from '../../ui/ConfirmPanel';
import { CoordinateBlock } from '../../ui/CoordinateBlock';

type Props = {
  waypoint: WaypointRow | null;
  onClose: () => void;
  onCopied?: () => void;
  onDeleted?: () => void;
};

export function WaypointMapDetailSheet({ waypoint, onClose, onCopied, onDeleted }: Props) {
  const { colors, spacing } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const setGoTo = useNavigationStore((s) => s.setGoTo);
  const removeWaypoint = useWaypointStore((s) => s.remove);

  if (!waypoint) return null;

  const posFix = fix && !isFixStale(fix) ? fix : lastGoodFix;
  const isGoTo = goToTarget?.id === waypoint.id && goToTarget.kind === 'waypoint';
  const typeLabel = t(`waypoints.types.${waypoint.type}` as 'waypoints.types.generic');

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

  function handleDelete() {
    void removeWaypoint(waypoint!.id).then(() => {
      onDeleted?.();
      onClose();
    });
  }

  return (
    <BottomSheet visible onClose={onClose} title={waypoint.name} subtitle={typeLabel} testID="waypointMap.sheet">
      {confirmDelete ? (
        <ConfirmPanel
          title={t('waypoints.deleteTitle')}
          message={waypoint.name}
          confirmLabel={t('waypoints.delete')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          testID="waypointMap.deleteConfirm"
        />
      ) : (
        <>
          {brgDist ? <Text style={[styles.meta, { color: colors.text }]}>{brgDist}</Text> : null}
          {isGoTo ? (
            <Text style={[styles.activeGoTo, { color: colors.success }]}>{t('map.waypointActiveGoTo')}</Text>
          ) : null}
          <CoordinateBlock latitude={waypoint.latitude} longitude={waypoint.longitude} onCopied={onCopied} />
          {waypoint.note?.trim() ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>{waypoint.note.trim()}</Text>
          ) : null}
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {!isGoTo ? (
              <Button
                label={t('waypoints.goTo')}
                onPress={() => void setGoTo(waypointToTarget(waypoint)).then(onClose)}
                testID="waypointMap.goTo"
              />
            ) : null}
            <Button label={t('waypoints.delete')} variant="danger" onPress={() => setConfirmDelete(true)} testID="waypointMap.delete" />
            <SheetDismissFooter onClose={onClose} testID="waypointMap.dismiss" />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, fontWeight: '700', marginTop: 4 },
  activeGoTo: { fontSize: 13, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  note: { ...typography.caption, lineHeight: 20, marginTop: 10 },
});
