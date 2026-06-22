import { useEffect, useRef } from 'react';

import { RACE_COUNTDOWN_MARKS_MS } from '../lib/racing/racingGeo';
import { t } from '../i18n';
import { triggerMaritimeAlarm } from './alarmFeedbackService';
import { useNavigationStore } from '../store/navigationStore';

/** Haptic/sound pulses at race countdown marks (5-4-1-0 style). */
export function useRaceCountdownMonitor() {
  const raceStartAtMs = useNavigationStore((s) => s.raceStartAtMs);
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!raceStartAtMs) {
      firedRef.current.clear();
      return;
    }

    const id = setInterval(() => {
      const remaining = raceStartAtMs - Date.now();
      if (remaining > 310_000) return;

      for (const mark of RACE_COUNTDOWN_MARKS_MS) {
        if (remaining > mark || remaining < mark - 400) continue;
        if (firedRef.current.has(mark)) continue;
        firedRef.current.add(mark);
        const minutes = Math.floor(mark / 60_000);
        const seconds = Math.floor((mark % 60_000) / 1000);
        const label =
          mark === 0
            ? t('race.countdownGo')
            : minutes > 0
              ? t('race.countdownMinutes', { min: minutes })
              : t('race.countdownSeconds', { sec: seconds });
        void triggerMaritimeAlarm(mark <= 10_000 ? 'critical' : 'warning', label);
      }
    }, 150);

    return () => clearInterval(id);
  }, [raceStartAtMs]);
}
