import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { RACING_PACK_V11 } from '../lib/featureFlags';
import { RACE_COUNTDOWN_MARKS_MS } from '../lib/racing/racingGeo';
import { t } from '../i18n';
import { triggerMaritimeAlarm } from './alarmFeedbackService';
import { useNavigationStore } from '../store/navigationStore';

const RACE_FIRED_KEY = 'seacheck.race.fired.v1';

type RaceFiredPersist = { raceStartAtMs: number; marks: number[] };

async function loadFiredMarks(raceStartAtMs: number): Promise<Set<number>> {
  const raw = await AsyncStorage.getItem(RACE_FIRED_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as RaceFiredPersist;
    if (parsed.raceStartAtMs !== raceStartAtMs) return new Set();
    return new Set(parsed.marks);
  } catch {
    return new Set();
  }
}

async function saveFiredMarks(raceStartAtMs: number, marks: Set<number>): Promise<void> {
  const payload: RaceFiredPersist = { raceStartAtMs, marks: [...marks] };
  await AsyncStorage.setItem(RACE_FIRED_KEY, JSON.stringify(payload));
}

/** Haptic/sound pulses at race countdown marks (5-4-1-0 style). */
export function useRaceCountdownMonitor() {
  const raceStartAtMs = useNavigationStore((s) => s.raceStartAtMs);
  const firedRef = useRef<Set<number>>(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!RACING_PACK_V11 || !raceStartAtMs) {
      firedRef.current.clear();
      hydratedRef.current = false;
      return;
    }

    void loadFiredMarks(raceStartAtMs).then((marks) => {
      firedRef.current = marks;
      hydratedRef.current = true;
    });

    const id = setInterval(() => {
      if (!hydratedRef.current) return;
      const remaining = raceStartAtMs - Date.now();
      if (remaining > 310_000) return;

      for (const mark of RACE_COUNTDOWN_MARKS_MS) {
        if (remaining > mark || remaining < mark - 400) continue;
        if (firedRef.current.has(mark)) continue;
        firedRef.current.add(mark);
        void saveFiredMarks(raceStartAtMs, firedRef.current);
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
