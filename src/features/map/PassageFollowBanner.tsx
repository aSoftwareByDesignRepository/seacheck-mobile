import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePassageFollow } from '../../hooks/usePassageFollow';
import { formatDistanceNm, distanceUnitLabel, formatXteLineFromNm } from '../../lib/geo/units';
import { t } from '../../i18n';
import { usePassageStore } from '../../store/passageStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  /** Slim strip for the map overlay (minimal layout). */
  compact?: boolean;
  onOpenPassage: () => void;
};

export function PassageFollowBanner({ compact = false, onOpenPassage }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const follow = usePassageFollow();
  const setPassageActiveLeg = usePassageStore((s) => s.setPassageActiveLeg);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);

  if (!follow.following) return null;

  const unitLabel = distanceUnitLabel(distanceUnit);
  const brgText =
    follow.bearingToNext != null ? `${Math.round(follow.bearingToNext)}° ${follow.bearingSuffix}` : '—';
  const distText =
    follow.distanceToNextNm != null
      ? `${formatDistanceNm(follow.distanceToNextNm, distanceUnit)} ${unitLabel}`
      : '—';
  const xteText = formatXteLineFromNm(follow.xteNm, distanceUnit, follow.xteSide);

  return (
    <View
      style={[
        styles.banner,
        compact ? styles.bannerCompact : null,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          marginBottom: compact ? 0 : spacing.sm,
        },
      ]}
      testID="map.passageFollow.banner"
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
      <Text style={[compact ? styles.nextWpCompact : styles.nextWp, { color: colors.text }]} numberOfLines={1}>
        {t('passage.nextWaypoint', { name: follow.nextWaypointName })}
      </Text>
      <View style={[styles.stats, { gap: compact ? spacing.sm : spacing.md, marginTop: compact ? spacing.xs : spacing.sm }]}>
        <StatBlock label={t('passage.brgToNext')} value={brgText} colors={colors} compact={compact} />
        <StatBlock label={t('map.distTo')} value={distText} colors={colors} compact={compact} />
        {xteText ? (
          <StatBlock label={t('map.xte')} value={xteText} colors={colors} compact={compact} />
        ) : null}
      </View>
      {follow.stale ? (
        <Text style={[styles.stale, { color: colors.warningText }]}>{t('map.staleCoordsHint')}</Text>
      ) : null}
      {follow.legWaypointArrived && !follow.isLastLeg ? (
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
      <View style={[styles.actions, { gap: spacing.sm, marginTop: compact ? spacing.xs : spacing.sm }]}>
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
            testID="map.passageFollow.nextLeg"
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
          testID="map.passageFollow.openPassage"
        >
          <Text style={[styles.actionSecondary, { color: colors.text }]}>{t('passage.openPassage')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatBlock({
  label,
  value,
  colors,
  compact = false,
}: {
  label: string;
  value: string;
  colors: { text: string; textMuted: string };
  compact?: boolean;
}) {
  return (
    <View style={[styles.stat, compact ? styles.statCompact : null]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[compact ? styles.statValueCompact : styles.statValueLarge, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  bannerCompact: { paddingHorizontal: 12, paddingVertical: 10 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  passageName: { flex: 1, fontSize: 14, fontWeight: '800', lineHeight: 20, minWidth: 0 },
  legMeta: { flexShrink: 0, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  nextWp: { fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 4 },
  nextWpCompact: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  stat: { minWidth: 88, flexGrow: 1, flexShrink: 1, maxWidth: '100%' },
  statCompact: { minWidth: 72 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 14 },
  statValueLarge: { fontSize: 22, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'], lineHeight: 28 },
  statValueCompact: { fontSize: 18, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'], lineHeight: 24 },
  stale: { fontSize: 12, lineHeight: 16, marginTop: 6, fontWeight: '600' },
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
