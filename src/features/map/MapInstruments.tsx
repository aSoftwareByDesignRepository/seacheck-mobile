import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBarometer } from '../../hooks/useBarometer';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useLegTimerMs } from '../../hooks/useLegTimer';
import { useNavigationInstruments } from '../../hooks/useNavigationInstruments';
import { formatLegElapsed } from '../../lib/racing/legTimer';
import { formatCoordinates } from '../../map/coords';
import { MAP_ATTRIBUTION } from '../../map/constants';
import { magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatSog } from '../../lib/geo/units';
import { formatCogDisplay } from '../../hooks/useNavigationInstruments';
import { t } from '../../i18n';
import { isFixStale, isLowSog, type LocationFix } from '../../services/locationService';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentCell } from '../../ui/InstrumentCell';
import { StatusBadge } from '../../ui/StatusBadge';

type Props = {
  fix: LocationFix | null;
  embedded?: boolean;
};

export function MapInstruments({ fix, embedded }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const { instrumentHeroSize } = useFormFactor();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const nav = useNavigationInstruments();
  const legTimerMs = useLegTimerMs();
  const barometer = useBarometer();

  const stale = isFixStale(fix);
  const isRace = activityProfileId === 'sailing-race';
  const declination = fix ? magneticDeclinationDeg(fix.latitude, fix.longitude) : 0;
  const cogText = stale ? '—' : formatCogDisplay(fix, bearingReference, declination);
  const sogText = stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const coords = fix && !stale ? formatCoordinates(coordFormat, fix.latitude, fix.longitude) : t('map.awaitingGps');

  async function copyCoords() {
    if (!fix || stale) return;
    await Clipboard.setStringAsync(formatCoordinates(coordFormat, fix.latitude, fix.longitude));
    showInfo(t('map.coordsCopied'));
  }

  const showNavRow = Boolean(goToTarget && !stale);
  const showXte = activityProfileId !== 'anchor-camp' && nav.xteNm != null && !stale;
  const showSession = nav.sessionDistanceNm > 0.01 && !isRace;
  const showLegTimer = isRace && activePassageId && legTimerMs != null;
  const showLegIndex = nav.activeLegNumber != null && nav.totalLegs != null;
  const showBarometer = barometer.available && barometer.trend.currentHpa != null;

  const statusBadges = (
    <>
      {anchorAlarm?.active ? (
        <StatusBadge
          label={anchorAlarm.triggered ? t('map.anchorTriggered') : t('map.anchorActive')}
          variant={anchorAlarm.triggered ? 'danger' : 'success'}
        />
      ) : null}
      {isLowSog(fix) && !stale ? <StatusBadge label={t('map.lowSog')} variant="warning" /> : null}
      {stale && fix ? <StatusBadge label={t('map.staleGps')} variant="danger" /> : null}
      {showBarometer && barometer.trend.trend === 'falling_fast' ? (
        <StatusBadge label={t('barometer.fallingFast')} variant="warning" />
      ) : null}
    </>
  );

  const coordsRow = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.copyCoords')}
      onPress={() => void copyCoords()}
      style={{ minHeight: minTouch, justifyContent: 'center' }}
      testID="map.coords.copy"
    >
      <Text style={[styles.coords, { color: colors.text }]} selectable>
        {coords}
      </Text>
    </Pressable>
  );

  const panelBody = isRace ? (
    <>
      {statusBadges}
      <View style={styles.row}>
        <InstrumentCell label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
        <InstrumentCell
          label={t('map.cog')}
          value={cogText.split(' ')[0]}
          unit={cogText.includes(' ') ? cogText.split(' ')[1] : undefined}
          hero
          heroSize={instrumentHeroSize}
        />
      </View>
      {showNavRow ? (
        <View style={styles.row}>
          <InstrumentCell
            label={t('race.brgToMark')}
            value={nav.bearingToTarget != null ? String(Math.round(nav.bearingToTarget)) : '—'}
            unit={nav.bearingSuffix}
          />
          <InstrumentCell
            label={t('map.xte')}
            value={nav.xteNm != null ? nav.xteNm.toFixed(2) : '—'}
            unit={nav.xteNm != null ? `NM ${nav.xteSide ?? ''}` : undefined}
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <InstrumentCell
          label={t('race.distToMark')}
          value={nav.distanceToTargetNm != null ? nav.distanceToTargetNm.toFixed(1) : '—'}
          unit={distanceUnit === 'nm' ? 'NM' : distanceUnit === 'km' ? 'km' : 'SM'}
        />
        <InstrumentCell label={t('race.legTime')} value={showLegTimer ? formatLegElapsed(legTimerMs) : '—'} />
      </View>
      <View style={styles.row}>
        {showLegIndex ? (
          <InstrumentCell label={t('race.legIndex')} value={`${nav.activeLegNumber}/${nav.totalLegs}`} />
        ) : (
          <InstrumentCell label={t('map.accuracy')} value={fix?.accuracyM != null && !stale ? `±${Math.round(fix.accuracyM)}` : '—'} unit="m" />
        )}
        {showBarometer ? (
          <InstrumentCell
            label={t('barometer.label')}
            value={barometer.trend.currentHpa!.toFixed(1)}
            unit={`hPa · ${t(`barometer.trend.${barometer.trend.trend}` as 'barometer.trend.steady')}`}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      {coordsRow}
    </>
  ) : (
    <>
      {statusBadges}
      <View style={styles.row}>
        <InstrumentCell label={t('map.cog')} value={cogText.split(' ')[0]} unit={cogText.includes(' ') ? cogText.split(' ')[1] : undefined} hero heroSize={instrumentHeroSize} />
        <InstrumentCell label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
        <InstrumentCell label={t('map.accuracy')} value={fix?.accuracyM != null && !stale ? `±${Math.round(fix.accuracyM)}` : '—'} unit="m" />
      </View>
      {showNavRow ? (
        <View style={styles.row}>
          <InstrumentCell
            label={goToTarget?.kind === 'mob' ? t('map.brgMob') : t('map.brgTo')}
            value={nav.bearingToTarget != null ? String(Math.round(nav.bearingToTarget)) : '—'}
            unit={nav.bearingSuffix}
          />
          <InstrumentCell
            label={t('map.distTo')}
            value={nav.distanceToTargetNm != null ? nav.distanceToTargetNm.toFixed(1) : '—'}
            unit={distanceUnit === 'nm' ? 'NM' : distanceUnit === 'km' ? 'km' : 'SM'}
          />
          <InstrumentCell label={t('map.eta')} value={nav.etaUtc ?? '—'} />
        </View>
      ) : null}
      {showXte ? (
        <View style={styles.row}>
          <InstrumentCell label={t('map.xte')} value={nav.xteNm!.toFixed(2)} unit={`NM ${nav.xteSide ?? ''}`} />
          {nav.activeLegLabel ? <InstrumentCell label={t('map.leg')} value={nav.activeLegLabel} /> : null}
        </View>
      ) : null}
      {showSession ? <InstrumentCell label={t('map.distanceRun')} value={nav.sessionDistanceNm.toFixed(1)} unit="NM" /> : null}
      {showBarometer ? (
        <InstrumentCell
          label={t('barometer.label')}
          value={barometer.trend.currentHpa!.toFixed(1)}
          unit={
            barometer.trend.delta3h != null
              ? `${barometer.trend.delta3h >= 0 ? '+' : ''}${barometer.trend.delta3h.toFixed(1)} / 3h`
              : 'hPa'
          }
        />
      ) : null}
      {coordsRow}
    </>
  );

  const panel = (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          marginHorizontal: embedded ? 0 : spacing.md,
        },
      ]}
      testID="map.instruments"
    >
      {panelBody}
      {!embedded ? (
        <Text style={[styles.attribution, { color: colors.textMuted }]} numberOfLines={2}>
          {MAP_ATTRIBUTION}
        </Text>
      ) : null}
    </View>
  );

  if (embedded) return panel;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  coords: { fontSize: 15, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
  attribution: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
