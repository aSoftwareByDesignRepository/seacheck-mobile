import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBarometer } from '../../hooks/useBarometer';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useMapShellLayout } from '../../hooks/useMapShellLayout';
import { useNavigationInstruments } from '../../hooks/useNavigationInstruments';
import { useLegTimerMs } from '../../hooks/useLegTimer';
import { formatLegElapsed } from '../../lib/racing/legTimer';
import { RACING_PACK_V11 } from '../../lib/featureFlags';
import { formatCoordinates } from '../../map/coords';
import { magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatSog, formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { formatCogDisplay } from '../../hooks/useNavigationInstruments';
import { t } from '../../i18n';
import { nextCoordFormat, coordFormatTitleKey } from '../../lib/settings/coordFormats';
import { computeLeeway } from '../../lib/geo/leeway';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import { isFixStale, isLowSog, displayCog, displayHeading, type LocationFix, useLocationStore } from '../../services/locationService';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentCell } from '../../ui/InstrumentCell';
import { StatusBadge } from '../../ui/StatusBadge';
import { MapCoordinatesCard } from './MapCoordinatesCard';

type Props = {
  fix: LocationFix | null;
  /** @deprecated Panel is always embedded in the map shell layout. */
  embedded?: boolean;
};

export function MapInstruments({ fix }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { instrumentHeroSize } = useFormFactor();
  const { coordinatesEmphasis } = useMapShellLayout();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const raceTargetSogKn = useSettingsStore((s) => s.raceTargetSogKn);
  const showInfo = useFeedbackStore((s) => s.showInfo);

  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const nav = useNavigationInstruments();
  const legTimerMs = useLegTimerMs();
  const barometer = useBarometer();

  const stale = isFixStale(fix);
  const coordFix = fix && !stale ? fix : lastGoodFix;
  const isRace = activityProfileId === 'sailing-race';
  const declination = coordFix ? magneticDeclinationDeg(coordFix.latitude, coordFix.longitude) : 0;
  const cogText = !coordFix ? '—' : stale ? '—' : formatCogDisplay(fix, bearingReference, declination);
  const sogText = !coordFix || stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const courseLabel = isLowSog(fix) && !stale ? t('map.hdg') : t('map.cog');
  const coordsMuted = stale && Boolean(coordFix);

  async function copyCoords() {
    if (!coordFix) return;
    await Clipboard.setStringAsync(formatCoordinates(coordFormat, coordFix.latitude, coordFix.longitude));
    showInfo(t('map.coordsCopied'));
  }

  async function cycleCoordFormat() {
    const next = nextCoordFormat(coordFormat);
    await patchSettings({ coordFormat: next });
    void pulseUiAcknowledgement();
    showInfo(t('map.coordFormatCycled', { format: t(coordFormatTitleKey(next)) }));
  }

  const showNavRow = Boolean(goToTarget && coordFix && !stale);
  const showXte = nav.xteNm != null && !stale;
  const showSession = true;
  const showPassageMeta = Boolean(activePassageId && nav.remainingNm != null && !stale);
  const showLegTimer = isRace && activePassageId && legTimerMs != null;
  const showLegIndex = nav.activeLegNumber != null && nav.totalLegs != null;
  const showBarometer = barometer.available && barometer.trend.currentHpa != null;
  const leeway = !stale ? computeLeeway(fix?.speedKn ?? null, displayHeading(fix), displayCog(fix)) : null;
  const distanceLabel = distanceUnitLabel(distanceUnit);
  const sessionDistText = formatDistanceNm(nav.sessionDistanceNm, distanceUnit);
  const remainingDistText = nav.remainingNm != null ? formatDistanceNm(nav.remainingNm, distanceUnit) : null;

  const statusBadges = (
    <View style={[styles.badgeRow, { gap: spacing.sm }]}>
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
    </View>
  );

  const coordsBlock =
    coordinatesEmphasis && coordFix ? (
      <MapCoordinatesCard
        latitude={coordFix.latitude}
        longitude={coordFix.longitude}
        format={coordFormat}
        stale={coordsMuted}
        onCopied={() => showInfo(t('map.coordsCopied'))}
        onCycleFormat={() => void cycleCoordFormat()}
      />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.copyCoords')}
        accessibilityHint={t('map.coordFormatCycleHint')}
        onPress={() => void copyCoords()}
        onLongPress={() => void cycleCoordFormat()}
        delayLongPress={400}
        style={[styles.coordsInline, { minHeight: minTouch, borderColor: colors.border, backgroundColor: colors.background }]}
        testID="map.coords.copy"
      >
        <Text style={[styles.coordsInlineText, { color: coordsMuted ? colors.textMuted : colors.text }]} selectable>
          {coordFix
            ? formatCoordinates(coordFormat, coordFix.latitude, coordFix.longitude)
            : t('map.awaitingGps')}
        </Text>
        {coordsMuted ? (
          <Text style={[styles.staleHint, { color: colors.textMuted }]}>{t('map.staleCoordsHint')}</Text>
        ) : null}
      </Pressable>
    );

  const panelBody = isRace ? (
    <>
      {statusBadges}
      {coordinatesEmphasis ? coordsBlock : null}
      <View style={styles.row}>
        <InstrumentCell label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
        <InstrumentCell
          label={courseLabel}
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
      {showNavRow && RACING_PACK_V11 && nav.vmgKn != null ? (
        <View style={styles.row}>
          <InstrumentCell label={t('race.vmg')} value={nav.vmgKn.toFixed(1)} unit="kn" />
          <InstrumentCell
            label={t('race.targetSog')}
            value={
              raceTargetSogKn != null && !stale && sogText !== '—'
                ? (Number.parseFloat(sogText) - raceTargetSogKn).toFixed(1)
                : '—'
            }
            unit={raceTargetSogKn != null ? 'Δ kn' : undefined}
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
      {!coordinatesEmphasis ? coordsBlock : null}
      <InstrumentCell label={t('map.distanceRun')} value={sessionDistText} unit={distanceLabel} />
    </>
  ) : coordinatesEmphasis ? (
    <>
      {statusBadges}
      {coordsBlock}
      <View style={styles.row}>
        <InstrumentCell label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
        <InstrumentCell
          label={courseLabel}
          value={cogText.split(' ')[0]}
          unit={cogText.includes(' ') ? cogText.split(' ')[1] : undefined}
          hero
          heroSize={instrumentHeroSize}
        />
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
        </View>
      ) : null}
      {showXte ? (
        <View style={styles.row}>
          <InstrumentCell label={t('map.xte')} value={nav.xteNm!.toFixed(2)} unit={`NM ${nav.xteSide ?? ''}`} />
          {nav.activeLegLabel ? <InstrumentCell label={t('map.leg')} value={nav.activeLegLabel} /> : null}
        </View>
      ) : null}
      {showPassageMeta ? (
        <View style={styles.row}>
          <InstrumentCell label={t('map.remainingNm')} value={remainingDistText!} unit={distanceLabel} />
          <InstrumentCell label={t('map.etaDest')} value={nav.etaDestUtc ?? nav.plannedEtaDestUtc ?? '—'} />
        </View>
      ) : null}
      {showSession ? (
        <InstrumentCell label={t('map.distanceRun')} value={sessionDistText} unit={distanceLabel} />
      ) : null}
    </>
  ) : (
    <>
      {statusBadges}
      <View style={styles.row}>
        <InstrumentCell label={courseLabel} value={cogText.split(' ')[0]} unit={cogText.includes(' ') ? cogText.split(' ')[1] : undefined} hero heroSize={instrumentHeroSize} />
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
      {showPassageMeta ? (
        <View style={styles.row}>
          <InstrumentCell label={t('map.remainingNm')} value={remainingDistText!} unit={distanceLabel} />
          <InstrumentCell label={t('map.etaDest')} value={nav.etaDestUtc ?? nav.plannedEtaDestUtc ?? '—'} />
        </View>
      ) : null}
      {showSession ? (
        <InstrumentCell label={t('map.distanceRun')} value={sessionDistText} unit={distanceLabel} />
      ) : null}
      {leeway ? (
        <InstrumentCell
          label={t('map.leeway')}
          value={Math.abs(leeway.angleDeg).toFixed(0)}
          unit={leeway.side === 'none' ? '°' : `° ${leeway.side === 'port' ? t('map.leewayPort') : t('map.leewayStarboard')}`}
        />
      ) : null}
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
      ) : fix?.altitudeM != null && !stale ? (
        <InstrumentCell label={t('map.gpsAlt')} value={Math.round(fix.altitudeM).toString()} unit="m" />
      ) : null}
      {coordsBlock}
    </>
  );

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID="map.instruments"
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { gap: spacing.md, paddingBottom: spacing.sm }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {panelBody}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, flexShrink: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  coordsInline: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  coordsInlineText: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  staleHint: { fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
