import { useEffect, useState } from 'react';

import { useNavigationInstruments } from './useNavigationInstruments';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore, type PassageWithLegs } from '../store/passageStore';

/** Active passage follow state — next waypoint, bearing, distance, leg context. */
export function usePassageFollow() {
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const passages = usePassageStore((s) => s.passages);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const nav = useNavigationInstruments();

  const [detail, setDetail] = useState<PassageWithLegs | null>(null);

  useEffect(() => {
    if (!activePassageId) {
      setDetail(null);
      return;
    }
    void getPassageDetail(activePassageId).then(setDetail);
  }, [activePassageId, activeLegIndex, passages, getPassageDetail]);

  const passage = passages.find((p) => p.id === activePassageId) ?? null;
  const totalLegs = detail?.legs.length ?? 0;
  const isLastLeg = totalLegs > 0 && activeLegIndex >= totalLegs - 1;
  const leg = detail?.legs[activeLegIndex] ?? null;

  return {
    following: Boolean(activePassageId && goToTarget && detail && detail.legs.length > 0),
    passageId: activePassageId,
    passageName: passage?.name ?? '',
    legIndex: activeLegIndex,
    legNumber: totalLegs > 0 ? activeLegIndex + 1 : 0,
    totalLegs,
    isLastLeg,
    legFromName: leg?.from.name ?? '',
    nextWaypointName: goToTarget?.name ?? leg?.to.name ?? '',
    bearingToNext: nav.bearingToTarget,
    bearingSuffix: nav.bearingSuffix,
    distanceToNextNm: nav.distanceToTargetNm,
    etaToNext: nav.etaUtc,
    xteNm: nav.xteNm,
    xteSide: nav.xteSide,
    remainingNm: nav.remainingNm,
    etaDestUtc: nav.etaDestUtc,
    plannedEtaDestUtc: nav.plannedEtaDestUtc,
    stale: nav.stale,
  };
}
