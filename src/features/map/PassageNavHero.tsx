import { StyleSheet, Text, View } from 'react-native';

import { formatDistanceNm, distanceUnitLabel, formatXteFromNm } from '../../lib/geo/units';
import type { DistanceUnit } from '../../settings/defaults';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { PassageStatGrid } from './PassageStatGrid';

type Props = {
  nextWaypointName: string;
  bearing: number | null;
  bearingSuffix: 'T' | 'M';
  distanceNm: number | null;
  distanceUnit: DistanceUnit;
  etaLocal: string | null;
  xteNm?: number | null;
  xteSide?: 'L' | 'R' | null;
  legNumber: number;
  totalLegs: number;
  isMob?: boolean;
  heroSize?: number;
  stale?: boolean;
};

/** Prominent bearing & distance to the next waypoint — Navionics-style nav strip. */
export function PassageNavHero({
  nextWaypointName,
  bearing,
  bearingSuffix,
  distanceNm,
  distanceUnit,
  etaLocal,
  xteNm = null,
  xteSide = null,
  legNumber,
  totalLegs,
  isMob = false,
  heroSize = 28,
  stale = false,
}: Props) {
  const { colors, spacing } = useTheme();
  const unitLabel = distanceUnitLabel(distanceUnit);
  const xteDisplay = formatXteFromNm(xteNm, distanceUnit, xteSide);
  const brgLabel = isMob ? t('map.brgMob') : t('passage.brgToNext');
  const distValue = distanceNm != null ? formatDistanceNm(distanceNm, distanceUnit) : '—';

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.background, borderColor: colors.primary, marginBottom: spacing.sm }]}
      accessibilityRole="summary"
      accessibilityLabel={t('passage.navHeroA11y', {
        name: nextWaypointName,
        brg: bearing != null ? Math.round(bearing) : '—',
        suffix: bearingSuffix,
        dist: distValue,
        unit: unitLabel,
        leg: legNumber,
        total: totalLegs,
      })}
      testID="map.passageNavHero"
    >
      <Text style={[styles.nextLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {t('passage.nextWaypoint', { name: nextWaypointName })}
      </Text>
      {totalLegs > 0 ? (
        <Text style={[styles.legHint, { color: colors.textMuted }]}>
          {t('passage.followLeg', { current: legNumber, total: totalLegs })}
        </Text>
      ) : null}
      <View style={{ marginTop: spacing.sm }}>
        <PassageStatGrid
          heroSize={heroSize}
          bearing={{
            key: 'navHero.brg',
            label: brgLabel,
            value: bearing != null ? String(Math.round(bearing)) : '—',
            unit: bearingSuffix,
          }}
          distance={{
            key: 'navHero.dist',
            label: t('map.distTo'),
            value: distValue,
            unit: unitLabel,
          }}
          eta={etaLocal ? { key: 'navHero.eta', label: t('map.eta'), value: etaLocal, hero: true } : null}
          xte={
            xteNm != null
              ? {
                  key: 'navHero.xte',
                  label: t('map.xte'),
                  value: xteDisplay.value,
                  unit: xteDisplay.unitLabel || undefined,
                }
              : null
          }
        />
      </View>
      {stale ? (
        <Text style={[styles.stale, { color: colors.warningText }]}>{t('map.staleCoordsHint')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, padding: 14, minWidth: 0 },
  nextLabel: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  legHint: { fontSize: 12, fontWeight: '600', marginTop: 2, lineHeight: 16 },
  stale: { fontSize: 12, lineHeight: 16, marginTop: 8, fontWeight: '600' },
});
