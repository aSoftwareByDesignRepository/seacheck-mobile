import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { enqueuePersist } from '../lib/persist/asyncPersistQueue';

const STORAGE_KEY = 'seacheck.passageMapPlanning.v1';

type PersistPayload = {
  passageId: string | null;
  revision: number;
  allowRouteEdits: boolean;
};

type PassageMapPlanningState = PersistPayload & {
  hydrated: boolean;
  /** Passage currently being built or edited on the chart. */
  hydrate: () => Promise<void>;
  startPlanning: (passageId: string, options?: { allowRouteEdits?: boolean }) => void;
  stopPlanning: () => void;
  bumpRevision: () => void;
  unlockRouteEdits: () => void;
};

async function persist(state: PersistPayload): Promise<void> {
  await enqueuePersist(STORAGE_KEY, () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)));
}

export const usePassageMapPlanningStore = create<PassageMapPlanningState>((set, get) => ({
  hydrated: false,
  passageId: null,
  revision: 0,
  allowRouteEdits: true,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload>;
        set({
          passageId: typeof parsed.passageId === 'string' ? parsed.passageId : null,
          revision: Math.max(0, Number(parsed.revision) || 0),
          allowRouteEdits: parsed.allowRouteEdits !== false,
        });
      } catch (error) {
        console.warn('[passageMapPlanningStore] hydrate failed', error);
      }
    }
    set({ hydrated: true });
  },

  startPlanning: (passageId, options) => {
    const allowRouteEdits = options?.allowRouteEdits ?? true;
    set({ passageId, revision: 0, allowRouteEdits });
    void persist({ passageId, revision: 0, allowRouteEdits });
  },

  stopPlanning: () => {
    set({ passageId: null, revision: 0, allowRouteEdits: true });
    void persist({ passageId: null, revision: 0, allowRouteEdits: true });
  },

  bumpRevision: () => {
    const next = get().revision + 1;
    set({ revision: next });
    void persist({
      passageId: get().passageId,
      revision: next,
      allowRouteEdits: get().allowRouteEdits,
    });
  },

  unlockRouteEdits: () => {
    set({ allowRouteEdits: true });
    void persist({
      passageId: get().passageId,
      revision: get().revision,
      allowRouteEdits: true,
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
  });
}
