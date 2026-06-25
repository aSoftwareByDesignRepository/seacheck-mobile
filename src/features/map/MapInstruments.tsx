import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { computeAnchorDriftNm } from '../../lib/anchor/anchorDrift';
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
import { isFixStale, isLowSog, displayCog, displayHeading, type LocationFix, useLocationStore, useMapDisplayFix } from '../../services/locationService';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentCell } from '../../ui/InstrumentCell';
import { StatusBadge } from '../../ui/StatusBadge';
import { MapCoordinatesCard } from './MapCoordinatesCard';
import { PassageNavHero } from './PassageNavHero';
import { BarometerInstrument } from './BarometerInstrument';

type Props = {
  fix: LocationFix | null;
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
  const mapDisplayFix = useMapDisplayFix();
  const nav = useNavigationInstruments();
  const legTimerMs = useLegTimerMs();
  const barometerEnabled = useSettingsStore((s) => s.barometerEnabled);
  const barometer = useBarometer(barometerEnabled);

  const stale = isFixStale(fix);
  const coordFix = mapDisplayFix ?? (fix && !stale ? fix : lastGoodFix);
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
  const showNavHero = Boolean(goToTarget);
  const showXte = nav.xteNm != null && !stale;
  const showSession = true;
  const showPassageMeta = Boolean(activePassageId && nav.remainingNm != null && !stale);
  const showLegTimer = isRace && activePassageId && legTimerMs != null;
  const showLegIndex = nav.activeLegNumber != null && nav.totalLegs != null;
  const showBarometer = barometerEnabled && barometer.available && barometer.trend.currentHpa != null;
  const leeway = !stale ? computeLeeway(fix?.speedKn ?? null, displayHeading(fix), displayCog(fix)) : null;
  const distanceLabel = distanceUnitLabel(distanceUnit);
  const sessionDistText = formatDistanceNm(nav.sessionDistanceNm, distanceUnit);
  const remainingDistText = nav.remainingNm != null ? formatDistanceNm(nav.remainingNm, distanceUnit) : null;
  const anchorDriftNm =
    anchorAlarm?.active && coordFix ? computeAnchorDriftNm(anchorAlarm, coordFix) : null;
  const anchorDriftText =
    anchorDriftNm != null ? formatDistanceNm(anchorDriftNm, distanceUnit) : null;
  const anchorLimitText =
    anchorAlarm?.active ? formatDistanceNm(anchorAlarm.radiusNm, distanceUnit) : null;

  const passageNavHero =
    showNavHero && goToTarget ? (
      <PassageNavHero
        nextWaypointName={goToTarget.name}
        bearing={nav.bearingToTarget}
        bearingSuffix={nav.bearingSuffix}
        distanceNm={nav.distanceToTargetNm}
        distanceUnit={distanceUnit}
        etaUtc={nav.etaUtc}
        xteNm={activePassageId ? nav.xteNm : null}
        xteSide={nav.xteSide}
        legNumber={nav.activeLegNumber ?? 0}
        totalLegs={nav.totalLegs ?? 0}
        isMob={goToTarget.kind === 'mob'}
        heroSize={instrumentHeroSize}
        stale={stale && Boolean(fix)}
      />
    ) : null;

  const barometerBlock = showBarometer ? <BarometerInstrument trend={barometer.trend} /> : null;

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

  const anchorDriftRow =
    anchorAlarm?.active && anchorDriftText && anchorLimitText ? (
      <View style={styles.row}>
        <InstrumentCell
          label={t('map.anchorDrift')}
          value={anchorDriftText}
          unit={`/ ${anchorLimitText}`}
          accessibilityLabel={t('map.anchorDriftA11y', {
            drift: anchorDriftText,
            limit: anchorLimitText,
          })}
          testID="map.anchorDrift"
        />
        <View style={{ flex: 1 }} />
      </View>
    ) : null;

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
      {anchorDriftRow}
      {barometerBlock}
      {passageNavHero}
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
      {!passageNavHero && showNavRow ? (
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
        <View style={{ flex: 1 }} />
      </View>
      {!coordinatesEmphasis ? coordsBlock : null}
      <InstrumentCell label={t('map.distanceRun')} value={sessionDistText} unit={distanceLabel} />
    </>
  ) : coordinatesEmphasis ? (
    <>
      {statusBadges}
      {barometerBlock}
      {passageNavHero}
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
      {showXte && !passageNavHero ? (
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
      {anchorDriftRow}
      {barometerBlock}
      {passageNavHero}
      <View style={styles.row}>
        <InstrumentCell label={courseLabel} value={cogText.split(' ')[0]} unit={cogText.includes(' ') ? cogText.split(' ')[1] : undefined} hero heroSize={instrumentHeroSize} />
        <InstrumentCell label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
        <InstrumentCell label={t('map.accuracy')} value={fix?.accuracyM != null && !stale ? `±${Math.round(fix.accuracyM)}` : '—'} unit="m" />
      </View>
      {showXte && !passageNavHero ? (
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
      {fix?.altitudeM != null && !stale ? (
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
  panel: { borderTopWidth: 1, flex: 1, flexShrink: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  coordsInline: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  coordsInlineText: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  staleHint: { fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
