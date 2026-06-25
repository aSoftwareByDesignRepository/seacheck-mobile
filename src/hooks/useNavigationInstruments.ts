import { useEffect, useMemo, useState } from 'react';

import { formatBearing, magneticDeclinationDeg } from '../lib/geo/magnetic';
import { bearingTrue, crossTrackErrorNm, distanceNm, legDurationHours, msToKnots, type LonLat } from '../lib/geo/navigation';
import { velocityMadeGoodKn } from '../lib/racing/racingGeo';
import { formatDistanceNm } from '../lib/geo/units';
import { displayCog, isFixStale, useLocationStore } from '../services/locationService';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';

export type NavigationInstruments = {
  stale: boolean;
  bearingToTarget: number | null;
  bearingSuffix: 'T' | 'M';
  distanceToTargetNm: number | null;
  etaUtc: string | null;
  xteNm: number | null;
  xteSide: 'L' | 'R' | null;
  sessionDistanceNm: number;
  activeLegLabel: string | null;
  activeLegNumber: number | null;
  totalLegs: number | null;
  remainingNm: number | null;
  etaDestUtc: string | null;
  plannedEtaDestUtc: string | null;
  vmgKn: number | null;
  bearingToMarkTrue: number | null;
};

export function useNavigationInstruments(): NavigationInstruments {
  const fix = useLocationStore((s) => s.fix);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const sessionDistanceNm = useNavigationStore((s) => s.sessionDistanceNm);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const [legLabel, setLegLabel] = useState<string | null>(null);
  const [legNumbers, setLegNumbers] = useState<{ current: number; total: number } | null>(null);
  const [xte, setXte] = useState<{ nm: number; side: 'L' | 'R' } | null>(null);
  const [remainingNm, setRemainingNm] = useState<number | null>(null);
  const [plannedEtaDestUtc, setPlannedEtaDestUtc] = useState<string | null>(null);

  const stale = isFixStale(fix);
  const pos: LonLat | null = fix ? [fix.longitude, fix.latitude] : null;

  const declination = useMemo(() => {
    if (!fix) return 0;
    return magneticDeclinationDeg(fix.latitude, fix.longitude);
  }, [fix?.latitude, fix?.longitude]);

  const targetInfo = useMemo(() => {
    if (!pos || !goToTarget || stale) return null;
    const target: LonLat = [goToTarget.longitude, goToTarget.latitude];
    const trueBearing = bearingTrue(pos, target);
    const formatted = formatBearing(trueBearing, bearingReference, declination);
    const dist = distanceNm(pos, target);
    const sogKn = fix?.speedKn ?? msToKnots(fix?.speedMs) ?? 0;
    const cogTrue = displayCog(fix);
    const vmg = cogTrue != null ? velocityMadeGoodKn(sogKn, cogTrue, trueBearing) : null;
    const eta =
      sogKn > 0.5
        ? new Date(Date.now() + legDurationHours(dist, sogKn) * 3_600_000).toISOString().slice(11, 16) + ' UTC'
        : null;
    return { bearing: formatted.value, suffix: formatted.suffix, dist, eta, vmgKn: vmg, bearingToMarkTrue: trueBearing };
  }, [pos, goToTarget, stale, bearingReference, declination, fix]);

  const etaDestUtc = useMemo(() => {
    if (remainingNm == null || stale || !fix) return null;
    const sogKn = fix.speedKn ?? msToKnots(fix.speedMs) ?? 0;
    if (sogKn <= 0.5) return null;
    return new Date(Date.now() + legDurationHours(remainingNm, sogKn) * 3_600_000).toISOString().slice(11, 16) + ' UTC';
  }, [remainingNm, stale, fix?.speedKn, fix?.speedMs]);

  useEffect(() => {
    if (!activePassageId || !pos || stale) {
      setLegLabel(null);
      setLegNumbers(null);
      setXte(null);
      setRemainingNm(null);
      setPlannedEtaDestUtc(null);
      return;
    }
    void getPassageDetail(activePassageId).then((detail) => {
      if (!detail || detail.legs.length === 0) {
        setLegLabel(null);
        setLegNumbers(null);
        setXte(null);
        setRemainingNm(null);
        setPlannedEtaDestUtc(null);
        return;
      }
      const idx = Math.min(activeLegIndex, detail.legs.length - 1);
      const leg = detail.legs[idx];
      setLegLabel(`${leg.from.name} → ${leg.to.name}`);
      setLegNumbers({ current: idx + 1, total: detail.legs.length });
      const xteVal = crossTrackErrorNm(
        pos,
        [leg.from.longitude, leg.from.latitude],
        [leg.to.longitude, leg.to.latitude],
      );
      setXte({ nm: Math.abs(xteVal), side: xteVal >= 0 ? 'R' : 'L' });

      const distToLegEnd = distanceNm(pos, [leg.to.longitude, leg.to.latitude]);
      let rem = distToLegEnd;
      for (let i = idx + 1; i < detail.legs.length; i++) {
        rem += detail.legs[i].distanceNm;
      }
      setRemainingNm(rem);
      const lastLeg = detail.legs[detail.legs.length - 1];
      setPlannedEtaDestUtc(lastLeg.etaUtc ? lastLeg.etaUtc.slice(11, 16) + ' UTC' : null);
    });
  }, [activePassageId, activeLegIndex, pos, stale, getPassageDetail]);

  return {
    stale,
    bearingToTarget: targetInfo?.bearing ?? null,
    bearingSuffix: targetInfo?.suffix ?? 'T',
    distanceToTargetNm: targetInfo?.dist ?? null,
    etaUtc: targetInfo?.eta ?? null,
    xteNm: xte?.nm ?? null,
    xteSide: xte?.side ?? null,
    sessionDistanceNm,
    activeLegLabel: legLabel,
    activeLegNumber: legNumbers?.current ?? null,
    totalLegs: legNumbers?.total ?? null,
    remainingNm,
    etaDestUtc,
    plannedEtaDestUtc,
    vmgKn: targetInfo?.vmgKn ?? null,
    bearingToMarkTrue: targetInfo?.bearingToMarkTrue ?? null,
  };
}

export function formatNavDistance(nm: number | null, unit: ReturnType<typeof useSettingsStore.getState>['distanceUnit']): string {
  return formatDistanceNm(nm, unit);
}

export function formatCogDisplay(fix: ReturnType<typeof useLocationStore.getState>['fix'], bearingReference: 'true' | 'magnetic', declination: number): string {
  const cog = displayCog(fix);
  if (cog == null) return '—';
  const formatted = formatBearing(cog, bearingReference, declination);
  return `${Math.round(formatted.value)}° ${formatted.suffix}`;
}
