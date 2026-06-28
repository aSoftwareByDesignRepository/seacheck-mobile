import { create } from 'zustand';

export type MeasurePoint = { latitude: number; longitude: number };

export const MEASURE_PLANNING_SOG_PRESETS = [4, 5, 6, 7] as const;

type MeasureDistanceStore = {
  active: boolean;
  points: MeasurePoint[];
  planningSogKn: number;
  start: () => void;
  stop: () => void;
  addPoint: (latitude: number, longitude: number) => void;
  undoLast: () => void;
  setPlanningSogKn: (kn: number) => void;
};

export const useMeasureDistanceStore = create<MeasureDistanceStore>((set, get) => ({
  active: false,
  points: [],
  planningSogKn: 5,

  start: () => {
    set({ active: true, points: [] });
  },

  stop: () => {
    set({ active: false, points: [] });
  },

  addPoint: (latitude, longitude) => {
    if (!get().active) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    set((state) => ({
      points: [...state.points, { latitude, longitude }],
    }));
  },

  undoLast: () => {
    set((state) => {
      if (state.points.length === 0) return state;
      return { points: state.points.slice(0, -1) };
    });
  },

  setPlanningSogKn: (kn) => {
    if (!Number.isFinite(kn) || kn <= 0) return;
    set({ planningSogKn: kn });
  },
}));

/** Test-only reset. */
export function resetMeasureDistanceStoreForTests(): void {
  useMeasureDistanceStore.setState({ active: false, points: [], planningSogKn: 5 });
}
