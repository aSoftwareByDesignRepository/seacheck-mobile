import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BAROMETER_SAMPLE_INTERVAL_MS,
  computeBarometerTrend,
  pruneBarometerReadings,
  type BarometerReading,
  type BarometerTrend,
} from '../lib/barometer/trend';

const STORAGE_KEY = 'seacheck.barometer.v1';

type BarometerState = {
  available: boolean;
  readings: BarometerReading[];
  trend: BarometerTrend;
  hydrated: boolean;
};

export type BarometerStateSnapshot = BarometerState;

type BarometerSensor = typeof import('expo-sensors').Barometer;

let sampleTimer: ReturnType<typeof setInterval> | null = null;
let subscription: { remove: () => void } | null = null;
let lastSampleTs = 0;
let barometerModule: BarometerSensor | null | undefined;

const listeners = new Set<(state: BarometerState) => void>();

let state: BarometerState = {
  available: false,
  readings: [],
  trend: { currentHpa: null, delta3h: null, trend: 'unknown' },
  hydrated: false,
};

function emit() {
  for (const listener of listeners) listener(state);
}

async function persistReadings(readings: BarometerReading[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ readings }));
}

async function loadReadings(): Promise<BarometerReading[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { readings?: BarometerReading[] };
    return Array.isArray(parsed.readings) ? parsed.readings : [];
  } catch {
    return [];
  }
}

/** Lazy-load expo-sensors so missing/broken native modules never crash startup. */
async function getBarometerSensor(): Promise<BarometerSensor | null> {
  if (barometerModule !== undefined) return barometerModule;
  try {
    const mod = await import('expo-sensors');
    barometerModule = mod.Barometer;
    return barometerModule;
  } catch {
    barometerModule = null;
    return null;
  }
}

async function probeBarometerAvailable(sensor: BarometerSensor): Promise<boolean> {
  try {
    return await sensor.isAvailableAsync();
  } catch {
    return false;
  }
}

function commitReading(pressure: number, ts = Date.now()) {
  if (!Number.isFinite(pressure) || pressure <= 800 || pressure >= 1100) return;
  const next = pruneBarometerReadings([...state.readings, { ts, hPa: pressure }], ts);
  state = {
    ...state,
    readings: next,
    trend: computeBarometerTrend(next, ts),
  };
  void persistReadings(next);
  emit();
}

export function subscribeBarometer(listener: (s: BarometerState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getBarometerState(): BarometerState {
  return state;
}

/** Hydrate cached readings and probe sensor availability. Never throws. */
export async function hydrateBarometer(): Promise<void> {
  try {
    const readings = await loadReadings();
    const pruned = pruneBarometerReadings(readings, Date.now());
    const sensor = await getBarometerSensor();
    const available = sensor ? await probeBarometerAvailable(sensor) : false;
    state = {
      available,
      readings: pruned,
      trend: computeBarometerTrend(pruned, Date.now()),
      hydrated: true,
    };
    if (pruned.length !== readings.length) {
      await persistReadings(pruned);
    }
    emit();
  } catch {
    state = {
      available: false,
      readings: [],
      trend: { currentHpa: null, delta3h: null, trend: 'unknown' },
      hydrated: true,
    };
    emit();
  }
}

export async function startBarometerSampling(): Promise<void> {
  await hydrateBarometer();
  if (!state.available || sampleTimer) return;

  const sensor = await getBarometerSensor();
  if (!sensor) return;

  try {
    sensor.setUpdateInterval(BAROMETER_SAMPLE_INTERVAL_MS);
    subscription = sensor.addListener(({ pressure }) => {
      const now = Date.now();
      if (now - lastSampleTs < BAROMETER_SAMPLE_INTERVAL_MS - 1000) return;
      lastSampleTs = now;
      commitReading(pressure, now);
    });

    sampleTimer = setInterval(() => {
      state = { ...state, trend: computeBarometerTrend(state.readings) };
      emit();
    }, 60_000);
  } catch {
    state = { ...state, available: false };
    emit();
  }
}

export function stopBarometerSampling(): void {
  subscription?.remove();
  subscription = null;
  if (sampleTimer) clearInterval(sampleTimer);
  sampleTimer = null;
}
