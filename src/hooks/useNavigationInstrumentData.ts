import { formatCogDisplay, useNavigationInstruments } from './useNavigationInstruments';
import { computeAnchorDriftNm } from '../lib/anchor/anchorDrift';
import { resolveLeewayDisplay } from '../lib/geo/leeway';
import { magneticDeclinationDeg } from '../lib/geo/magnetic';
import { msToKnots } from '../lib/geo/navigation';
import { distanceUnitLabel, formatDistanceNm, formatSog, formatXteFromNm } from '../lib/geo/units';
import { t } from '../i18n';
import {
  displayCog,
  displayHeading,
  isFixStale,
  isLowSog,
  type LocationFix,
  useLocationStore,
  useMapDisplayFix,
} from '../services/locationService';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';

export type NavigationInstrumentData = {
  stale: boolean;
  coordFix: LocationFix | null;
  coordsMuted: boolean;
  cogText: string;
  sogText: string;
  courseLabel: string;
  accuracyText: string;
  goToTarget: ReturnType<typeof useNavigationStore.getState>['goToTarget'];
  anchorAlarm: ReturnType<typeof useNavigationStore.getState>['anchorAlarm'];
  nav: ReturnType<typeof useNavigationInstruments>;
  showNavHero: boolean;
  showXte: boolean;
  showPassageMeta: boolean;
  showLeeway: boolean;
  leeway: ReturnType<typeof resolveLeewayDisplay>['leeway'];
  distanceLabel: string;
  remainingDistText: string | null;
  anchorDriftText: string | null;
  anchorLimitText: string | null;
  xteDisplay: ReturnType<typeof formatXteFromNm>;
  activePassageId: string | null;
};

export function useNavigationInstrumentData(fix: LocationFix | null): NavigationInstrumentData {
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const mapShowXte = useSettingsStore((s) => s.mapShowXte);
  const mapShowLeeway = useSettingsStore((s) => s.mapShowLeeway);

  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const mapDisplayFix = useMapDisplayFix();
  const nav = useNavigationInstruments();

  const stale = isFixStale(fix);
  const coordFix = mapDisplayFix ?? (fix && !stale ? fix : lastGoodFix);
  const declination = coordFix ? magneticDeclinationDeg(coordFix.latitude, coordFix.longitude) : 0;
  const cogText = !coordFix ? '—' : stale ? '—' : formatCogDisplay(fix, bearingReference, declination);
  const sogText = !coordFix || stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const courseLabel = isLowSog(fix) && !stale ? t('map.hdg') : t('map.cog');
  const coordsMuted = stale && Boolean(coordFix);
  const accuracyText = fix?.accuracyM != null && !stale ? `±${Math.round(fix.accuracyM)}` : '—';

  const showNavHero = Boolean(goToTarget);
  const showXte =
    mapShowXte && nav.xteNm != null && !stale && goToTarget?.kind !== 'mob' && Boolean(activePassageId);
  const showPassageMeta = Boolean(activePassageId && nav.remainingNm != null && !stale);
  const sogKn = fix?.speedKn ?? msToKnots(fix?.speedMs ?? null);
  const { showLeeway, leeway } = resolveLeewayDisplay({
    mapShowLeeway,
    stale,
    sogKn,
    headingDeg: displayHeading(fix),
    cogDeg: displayCog(fix),
  });
  const distanceLabel = distanceUnitLabel(distanceUnit);
  const remainingDistText = nav.remainingNm != null ? formatDistanceNm(nav.remainingNm, distanceUnit) : null;
  const anchorDriftNm =
    anchorAlarm?.active && coordFix ? computeAnchorDriftNm(anchorAlarm, coordFix) : null;
  const anchorDriftText = anchorDriftNm != null ? formatDistanceNm(anchorDriftNm, distanceUnit) : null;
  const anchorLimitText = anchorAlarm?.active ? formatDistanceNm(anchorAlarm.radiusNm, distanceUnit) : null;
  const xteDisplay = formatXteFromNm(nav.xteNm, distanceUnit, nav.xteSide);

  return {
    stale,
    coordFix,
    coordsMuted,
    cogText,
    sogText,
    courseLabel,
    accuracyText,
    goToTarget,
    anchorAlarm,
    nav,
    showNavHero,
    showXte,
    showPassageMeta,
    showLeeway,
    leeway,
    distanceLabel,
    remainingDistText,
    anchorDriftText,
    anchorLimitText,
    xteDisplay,
    activePassageId,
  };
}
