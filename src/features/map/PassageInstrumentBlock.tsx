import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useNavigationInstrumentData } from '../../hooks/useNavigationInstrumentData';
import { usePassageFollow } from '../../hooks/usePassageFollow';
import { formatDistanceNm, distanceUnitLabel, formatXteFromNm } from '../../lib/geo/units';
import { t } from '../../i18n';
import type { LocationFix } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentCell } from '../../ui/InstrumentCell';
import { InstrumentChip } from '../../ui/InstrumentChip';
import { compactChipMinHeight } from '../../ui/instrumentLayout';
import { PassageNavHero } from './PassageNavHero';
import { PassageStatGrid } from './PassageStatGrid';

type Props = {
  fix: LocationFix | null;
  /** Dock strip on the map; full panel in instruments-only layout. */
  density?: 'dock' | 'full';
  /** Minimal map layout — only bearing and distance while following. */
  followDetail?: 'minimal' | 'standard';
  onOpenPassage: () => void;
};

/**
 * Passage follow + MOB navigation in instrument panels — bearing, distance, leg actions.
 */
export function PassageInstrumentBlock({
  fix,
  density = 'dock',
  followDetail = 'standard',
  onOpenPassage,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { instrumentHeroSize, instrumentFullScreenHeroSize } = useFormFactor();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const follow = usePassageFollow();
  const data = useNavigationInstrumentData(fix);
  const setPassageActiveLeg = usePassageStore((s) => s.setPassageActiveLeg);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);

  const isFull = density === 'full';
  const isMinimalFollow = followDetail === 'minimal' && !isFull;
  const heroSize = isFull ? instrumentFullScreenHeroSize - 8 : Math.max(22, instrumentHeroSize - 4);

  if (data.showNavHero && data.goToTarget?.kind === 'mob') {
    return (
      <PassageNavHero
        nextWaypointName={data.goToTarget.name}
        bearing={data.nav.bearingToTarget}
        bearingSuffix={data.nav.bearingSuffix}
        distanceNm={data.nav.distanceToTargetNm}
        distanceUnit={distanceUnit}
        etaLocal={data.nav.etaLocal}
        legNumber={0}
        totalLegs={0}
        isMob
        heroSize={heroSize}
        stale={data.stale && Boolean(fix)}
      />
    );
  }

  if (!follow.following) return null;

  const unitLabel = distanceUnitLabel(distanceUnit);
  const brgText =
    follow.bearingToNext != null ? `${Math.round(follow.bearingToNext)}° ${follow.bearingSuffix}` : '—';
  const distText =
    follow.distanceToNextNm != null
      ? `${formatDistanceNm(follow.distanceToNextNm, distanceUnit)} ${unitLabel}`
      : '—';
  const xteDisplay = formatXteFromNm(follow.xteNm, distanceUnit, follow.xteSide);
  const showExtendedStats = !isMinimalFollow;
  const showXte = data.showXte && follow.xteNm != null;

  if (isMinimalFollow) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('passage.followBannerA11y', {
          passage: follow.passageName,
          leg: follow.legNumber,
          total: follow.totalLegs,
          name: follow.nextWaypointName,
          brg: brgText,
          dist: distText,
        })}
        accessibilityHint={t('passage.openPassage')}
        onPress={onOpenPassage}
        style={[
          styles.wrap,
          styles.wrapMinimal,
          { backgroundColor: colors.surface, borderColor: colors.primary },
        ]}
        testID="map.passageInstrument"
      >
        <Text style={[styles.minimalMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {follow.passageName} · {t('passage.followLeg', { current: follow.legNumber, total: follow.totalLegs })} ·{' '}
          {follow.nextWaypointName}
        </Text>
        <View style={[styles.minimalRow, { gap: spacing.sm, marginTop: spacing.xs }]}>
          <InstrumentChip
            label={t('passage.brgToNext')}
            value={follow.bearingToNext != null ? String(Math.round(follow.bearingToNext)) : '—'}
            unit={follow.bearingSuffix}
            flex={1}
          />
          <InstrumentChip
            label={t('map.distTo')}
            value={follow.distanceToNextNm != null ? formatDistanceNm(follow.distanceToNextNm, distanceUnit) : '—'}
            unit={unitLabel}
            flex={1}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        isFull ? styles.wrapFull : styles.wrapDock,
        { backgroundColor: colors.surface, borderColor: colors.primary },
      ]}
      testID="map.passageInstrument"
      accessibilityRole="summary"
      accessibilityLabel={t('passage.followBannerA11y', {
        passage: follow.passageName,
        leg: follow.legNumber,
        total: follow.totalLegs,
        name: follow.nextWaypointName,
        brg: brgText,
        dist: distText,
      })}
    >
      <View style={styles.header}>
        <Text style={[styles.passageName, { color: colors.text }]} numberOfLines={1}>
          {follow.passageName}
        </Text>
        <Text style={[styles.legMeta, { color: colors.textMuted }]}>
          {t('passage.followLeg', { current: follow.legNumber, total: follow.totalLegs })}
        </Text>
      </View>

      <Text style={[isFull ? styles.nextWpFull : styles.nextWpDock, { color: colors.text }]} numberOfLines={2}>
        {t('passage.nextWaypoint', { name: follow.nextWaypointName })}
      </Text>

      {showExtendedStats ? (
        <View style={{ marginTop: spacing.sm }}>
          <PassageStatGrid
            heroSize={heroSize}
            bearing={{
              key: 'passage.brg',
              label: t('passage.brgToNext'),
              value: follow.bearingToNext != null ? String(Math.round(follow.bearingToNext)) : '—',
              unit: follow.bearingSuffix,
            }}
            distance={{
              key: 'passage.dist',
              label: t('map.distTo'),
              value: follow.distanceToNextNm != null ? formatDistanceNm(follow.distanceToNextNm, distanceUnit) : '—',
              unit: unitLabel,
            }}
            eta={
              follow.etaToNext
                ? { key: 'passage.eta', label: t('map.eta'), value: follow.etaToNext, hero: true }
                : null
            }
            xte={
              showXte
                ? {
                    key: 'passage.xte',
                    label: t('map.xte'),
                    value: xteDisplay.value,
                    unit: xteDisplay.unitLabel || undefined,
                  }
                : null
            }
          />
        </View>
      ) : null}

      {showExtendedStats && data.showPassageMeta && data.remainingDistText ? (
        <View style={[styles.metaRow, { gap: spacing.md, marginTop: spacing.sm }]}>
          <InstrumentCell
            label={t('map.remainingNm')}
            value={data.remainingDistText}
            unit={data.distanceLabel}
          />
          <InstrumentCell
            label={t('map.etaDest')}
            value={data.nav.etaDestLocal ?? data.nav.plannedEtaDestLocal ?? '—'}
          />
        </View>
      ) : null}

      {showExtendedStats && follow.stale ? (
        <Text style={[styles.stale, { color: colors.warningText }]}>{t('map.staleCoordsHint')}</Text>
      ) : null}

      {showExtendedStats && follow.legWaypointArrived && !follow.isLastLeg ? (
        <View
          style={[
            styles.passedHint,
            { backgroundColor: colors.warningBg, borderColor: colors.warningBorder, marginTop: spacing.sm },
          ]}
          accessibilityRole="text"
        >
          <Text style={[styles.passedHintText, { color: colors.warningText }]}>
            {follow.legWaypointPassedAlongTrack
              ? t('passage.waypointPassedAlongTrack', { name: follow.nextWaypointName })
              : t('passage.waypointArrivedNear', { name: follow.nextWaypointName })}
          </Text>
        </View>
      ) : null}

      <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.sm }]}>
        {!follow.isLastLeg ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('passage.skipToNextWaypoint')}
            accessibilityHint={t('passage.skipToNextWaypointHint')}
            onPress={() => void setPassageActiveLeg(activeLegIndex + 1)}
            style={[
              styles.actionBtn,
              follow.legWaypointArrived
                ? { borderColor: colors.primary, backgroundColor: colors.primary, minHeight: minTouch }
                : { borderColor: colors.primary, minHeight: minTouch },
            ]}
            testID="map.passageInstrument.nextLeg"
          >
            <Text
              style={[
                styles.actionPrimary,
                { color: follow.legWaypointArrived ? colors.primaryText : colors.primary },
              ]}
            >
              {t('passage.skipToNextWaypoint')}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.finalChip, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
            <Text style={[styles.finalText, { color: colors.success }]}>{t('passage.finalLeg')}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('passage.openPassage')}
          onPress={onOpenPassage}
          style={[styles.actionBtn, { borderColor: colors.border, minHeight: minTouch }]}
          testID="map.passageInstrument.openPassage"
        >
          <Text style={[styles.actionSecondary, { color: colors.text }]}>{t('passage.openPassage')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, minWidth: 0 },
  wrapDock: { padding: 12 },
  wrapMinimal: { paddingVertical: 8, paddingHorizontal: 10 },
  wrapFull: { padding: 16, borderRadius: 18 },
  minimalMeta: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  minimalRow: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0, minHeight: compactChipMinHeight() },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  passageName: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 22, minWidth: 0 },
  legMeta: { flexShrink: 0, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  nextWpDock: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 4 },
  nextWpFull: { fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', minWidth: 0 },
  stale: { fontSize: 12, lineHeight: 16, marginTop: 8, fontWeight: '600' },
  passedHint: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  passedHintText: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 0,
  },
  actionPrimary: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  actionSecondary: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  finalChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  finalText: { fontSize: 13, fontWeight: '800' },
});
