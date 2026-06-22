import { create } from 'zustand';

import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import { boundsCenter, normalizeBounds, type LonLatPoint } from '../lib/map/bounds';

type CustomDownloadState = {
  selecting: boolean;
  cornerA: LonLatPoint | null;
  cornerB: LonLatPoint | null;
  minZoom: number;
  maxZoom: number;
  packName: string;
  startSelecting: () => void;
  cancelSelecting: () => void;
  setCorner: (point: LonLatPoint) => void;
  resetCorners: () => void;
  setZoomRange: (minZoom: number, maxZoom: number) => void;
  setPackName: (name: string) => void;
  getBounds: () => LngLatBounds | null;
};

export const useCustomDownloadStore = create<CustomDownloadState>((set, get) => ({
  selecting: false,
  cornerA: null,
  cornerB: null,
  minZoom: 10,
  maxZoom: 14,
  packName: '',

  startSelecting: () => {
    set({ selecting: true, cornerA: null, cornerB: null, packName: '' });
  },

  cancelSelecting: () => {
    set({ selecting: false, cornerA: null, cornerB: null, packName: '' });
  },

  setCorner: (point) => {
    const { cornerA, cornerB } = get();
    if (!cornerA) {
      set({ cornerA: point });
      return;
    }
    if (!cornerB) {
      const bounds = normalizeBounds(cornerA, point);
      const center = boundsCenter(bounds);
      set({
        cornerB: point,
        packName: get().packName || `Custom ${center.latitude.toFixed(2)}°N ${center.longitude.toFixed(2)}°E`,
      });
      return;
    }
    set({ cornerA: point, cornerB: null, packName: '' });
  },

  resetCorners: () => set({ cornerA: null, cornerB: null, packName: '' }),

  setZoomRange: (minZoom, maxZoom) => set({ minZoom, maxZoom: Math.max(minZoom, maxZoom) }),

  setPackName: (name) => set({ packName: name }),

  getBounds: () => {
    const { cornerA, cornerB } = get();
    if (!cornerA || !cornerB) return null;
    return normalizeBounds(cornerA, cornerB);
  },
}));
