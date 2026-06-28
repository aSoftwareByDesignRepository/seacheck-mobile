import { create } from 'zustand';

type PassageMapPlanningState = {
  /** Passage currently being built or edited on the chart. */
  passageId: string | null;
  /** Bumped when waypoints are added on the chart so panels refresh. */
  revision: number;
  startPlanning: (passageId: string) => void;
  stopPlanning: () => void;
  bumpRevision: () => void;
};

export const usePassageMapPlanningStore = create<PassageMapPlanningState>((set) => ({
  passageId: null,
  revision: 0,
  startPlanning: (passageId) => set({ passageId, revision: 0 }),
  stopPlanning: () => set({ passageId: null, revision: 0 }),
  bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
}));

/** Test-only reset. */
export function resetPassageMapPlanningStoreForTests(): void {
  usePassageMapPlanningStore.setState({ passageId: null, revision: 0 });
}
