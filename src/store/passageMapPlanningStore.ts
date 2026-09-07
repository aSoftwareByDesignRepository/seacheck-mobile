import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { enqueuePersist } from '../lib/persist/asyncPersistQueue';
import { parsePersistedBoolean } from '../lib/settings/parsePersistedBoolean';

const STORAGE_KEY = 'seacheck.passageMapPlanning.v1';

type PersistPayload = {
  passageId: string | null;
  revision: number;
  allowRouteEdits: boolean;
  guideDismissedForSession: boolean;
};

type PassageMapPlanningState = PersistPayload & {
  hydrated: boolean;
  /**
   * Ephemeral counter — NavigationMap fits the route when this bumps.
   * Not persisted; waypoint revisions must not auto-fit the camera.
   */
  fitRouteRequestId: number;
  /** Passage currently being built or edited on the chart. */
  hydrate: () => Promise<void>;
  startPlanning: (passageId: string, options?: { allowRouteEdits?: boolean }) => void;
  stopPlanning: () => void;
  bumpRevision: () => void;
  /** Explicit "show whole route" — does not bump revision. */
  requestFitRoute: () => void;
  unlockRouteEdits: () => void;
  dismissGuideForSession: () => void;
};

async function persist(state: PersistPayload): Promise<void> {
  await enqueuePersist(STORAGE_KEY, () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)));
}

export const usePassageMapPlanningStore = create<PassageMapPlanningState>((set, get) => ({
  hydrated: false,
  passageId: null,
  revision: 0,
  allowRouteEdits: true,
  guideDismissedForSession: false,
  fitRouteRequestId: 0,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload>;
        set({
          passageId: typeof parsed.passageId === 'string' ? parsed.passageId : null,
          revision: Math.max(0, Number(parsed.revision) || 0),
          allowRouteEdits: parsePersistedBoolean(parsed.allowRouteEdits, true),
          guideDismissedForSession: false,
        });
      } catch (error) {
        console.warn('[passageMapPlanningStore] hydrate failed', error);
      }
    }
    set({ hydrated: true });
  },

  startPlanning: (passageId, options) => {
    const allowRouteEdits = options?.allowRouteEdits ?? true;
    set({ passageId, revision: 0, allowRouteEdits, guideDismissedForSession: false });
    void persist({ passageId, revision: 0, allowRouteEdits, guideDismissedForSession: false });
  },

  stopPlanning: () => {
    set({ passageId: null, revision: 0, allowRouteEdits: true, guideDismissedForSession: false });
    void persist({ passageId: null, revision: 0, allowRouteEdits: true, guideDismissedForSession: false });
  },

  bumpRevision: () => {
    const next = get().revision + 1;
    set({ revision: next });
    void persist({
      passageId: get().passageId,
      revision: next,
      allowRouteEdits: get().allowRouteEdits,
      guideDismissedForSession: get().guideDismissedForSession,
    });
  },

  requestFitRoute: () => {
    if (!get().passageId) return;
    set({ fitRouteRequestId: get().fitRouteRequestId + 1 });
  },

  unlockRouteEdits: () => {
    set({ allowRouteEdits: true });
    void persist({
      passageId: get().passageId,
      revision: get().revision,
      allowRouteEdits: true,
      guideDismissedForSession: get().guideDismissedForSession,
    });
  },

  dismissGuideForSession: () => {
    set({ guideDismissedForSession: true });
    void persist({
      passageId: get().passageId,
      revision: get().revision,
      allowRouteEdits: get().allowRouteEdits,
      guideDismissedForSession: true,
    });
  },
}));

/** Test-only reset. */
export function resetPassageMapPlanningStoreForTests(): void {
  usePassageMapPlanningStore.setState({
    hydrated: true,
    passageId: null,
    revision: 0,
    allowRouteEdits: true,
    guideDismissedForSession: false,
    fitRouteRequestId: 0,
  });
}
