import { useEffect, useState } from 'react';

type BatteryModule = typeof import('expo-battery');

async function loadBatteryModule(): Promise<BatteryModule | null> {
  try {
    return await import('expo-battery');
  } catch {
    return null;
  }
}

export function useBatteryLevel(enabled: boolean): number | null {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLevel(null);
      return;
    }

    let active = true;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const Battery = await loadBatteryModule();
      if (!Battery || !active) return;
      try {
        const available = await Battery.isAvailableAsync();
        if (!available || !active) return;
        const pct = await Battery.getBatteryLevelAsync();
        if (active) setLevel(Math.round(pct * 100));
        subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
          if (active) setLevel(Math.round(batteryLevel * 100));
        });
      } catch {
        if (active) setLevel(null);
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);

  return level;
}
