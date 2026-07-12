import { create } from 'zustand';

import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import {
  boundsCenter,
  validateDownloadBounds,
  type BoundsValidation,
  type LonLatPoint,
} from '../lib/map/bounds';
import { stopPassageMapPlanning } from '../lib/passage/passageMapPlanning';
import {
  boundsFromPoints,
  createDownloadCorner,
  CUSTOM_DOWNLOAD_CORNER_COUNT,
  rectangleCornersFromBounds,
  type DownloadCorner,
  reindexDownloadCorners,
} from '../lib/map/customDownloadCorners';

export type CustomDownloadPhase = 'placing' | 'complete';

export type CornerMutationResult =
  | { kind: 'added'; index: number; complete: boolean }
  | { kind: 'moved'; index: number }
  | { kind: 'removed'; index: number }
  | { kind: 'complete_invalid'; code: Exclude<BoundsValidation, { ok: true }>['code'] }
  | { kind: 'noop' };

type CustomDownloadState = {
  selecting: boolean;
  corners: DownloadCorner[];
  phase: CustomDownloadPhase;
  selectedCornerId: string | null;
  /** When set, the next chart tap relocates this corner. */
  relocateCornerId: string | null;
  minZoom: number;
  maxZoom: number;
  packName: string;
  startSelecting: () => void;
  cancelSelecting: () => void;
  addCorner: (point: LonLatPoint) => CornerMutationResult;
  selectCorner: (id: string | null) => void;
  startRelocateCorner: (id: string) => void;
  cancelRelocate: () => void;
  moveCorner: (id: string, point: LonLatPoint) => CornerMutationResult;
  removeCorner: (id: string) => CornerMutationResult;
  resetCorners: () => void;
  setZoomRange: (minZoom: number, maxZoom: number) => void;
  setPackName: (name: string) => void;
  prefillFromBounds: (bounds: [number, number, number, number], name: string) => void;
  getBounds: () => LngLatBounds | null;
  getPreviewBounds: () => LngLatBounds | null;
  isComplete: () => boolean;
};

function derivePhase(corners: DownloadCorner[]): CustomDownloadPhase {
  return corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT ? 'complete' : 'placing';
}

function autoPackName(bounds: LngLatBounds, existing: string): string {
  if (existing.trim()) return existing;
  const center = boundsCenter(bounds);
  return `Custom ${center.latitude.toFixed(2)}°N ${center.longitude.toFixed(2)}°E`;
}

function validateIfComplete(
  corners: DownloadCorner[],
  minZoom: number,
  maxZoom: number,
): CornerMutationResult | null {
  if (corners.length < CUSTOM_DOWNLOAD_CORNER_COUNT) return null;
  const bounds = boundsFromPoints(corners);
  if (!bounds) return null;
  const validation = validateDownloadBounds(bounds, minZoom, maxZoom);
  if (!validation.ok) {
    return { kind: 'complete_invalid', code: validation.code };
  }
  return null;
}

export const useCustomDownloadStore = create<CustomDownloadState>((set, get) => ({
  selecting: false,
  corners: [],
  phase: 'placing',
  selectedCornerId: null,
  relocateCornerId: null,
  minZoom: 10,
  maxZoom: 14,
  packName: '',

  startSelecting: () => {
    stopPassageMapPlanning();
    set({
      selecting: true,
      corners: [],
      phase: 'placing',
      selectedCornerId: null,
      relocateCornerId: null,
      packName: '',
    });
  },

  cancelSelecting: () => {
    set({
      selecting: false,
      corners: [],
      phase: 'placing',
      selectedCornerId: null,
      relocateCornerId: null,
      packName: '',
    });
  },

  addCorner: (point) => {
    const { corners, minZoom, maxZoom, packName } = get();
    if (corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT) {
      return { kind: 'noop' };
    }
    const next = [...corners, createDownloadCorner(point, corners.length + 1)];
    const phase = derivePhase(next);
    const bounds = boundsFromPoints(next);
    const invalid = validateIfComplete(next, minZoom, maxZoom);
    set({
      corners: next,
      phase,
      selectedCornerId: null,
      relocateCornerId: null,
      packName: bounds ? autoPackName(bounds, packName) : packName,
    });
    if (invalid) return invalid;
    return { kind: 'added', index: next.length, complete: phase === 'complete' };
  },

  selectCorner: (id) => set({ selectedCornerId: id, relocateCornerId: null }),

  startRelocateCorner: (id) => set({ relocateCornerId: id, selectedCornerId: null }),

  cancelRelocate: () => set({ relocateCornerId: null }),

  moveCorner: (id, point) => {
    const { corners, minZoom, maxZoom, packName } = get();
    const index = corners.findIndex((c) => c.id === id);
    if (index < 0) return { kind: 'noop' };
    const next = corners.map((c) => (c.id === id ? { ...c, latitude: point.latitude, longitude: point.longitude } : c));
    const bounds = boundsFromPoints(next);
    const invalid = validateIfComplete(next, minZoom, maxZoom);
    set({
      corners: next,
      relocateCornerId: null,
      packName: bounds ? autoPackName(bounds, packName) : packName,
    });
    if (invalid) return invalid;
    return { kind: 'moved', index: index + 1 };
  },

  removeCorner: (id) => {
    const { corners, packName } = get();
    const index = corners.findIndex((c) => c.id === id);
    if (index < 0) return { kind: 'noop' };
    const next = reindexDownloadCorners(corners.filter((c) => c.id !== id));
    const phase = derivePhase(next);
    const bounds = boundsFromPoints(next);
    set({
      corners: next,
      phase,
      selectedCornerId: null,
      relocateCornerId: null,
      packName: bounds ? autoPackName(bounds, packName) : '',
    });
    return { kind: 'removed', index: index + 1 };
  },

  resetCorners: () =>
    set({
      corners: [],
      phase: 'placing',
      selectedCornerId: null,
      relocateCornerId: null,
      packName: '',
    }),

  setZoomRange: (minZoom, maxZoom) => set({ minZoom, maxZoom: Math.max(minZoom, maxZoom) }),

  setPackName: (name) => set({ packName: name }),

  prefillFromBounds: (bounds, name) => {
    stopPassageMapPlanning();
    const points = rectangleCornersFromBounds(bounds);
    const corners = points.map((point, i) => createDownloadCorner(point, i + 1));
    set({
      selecting: true,
      corners,
      phase: 'complete',
      selectedCornerId: null,
      relocateCornerId: null,
      packName: name,
    });
  },

  getBounds: () => {
    const { corners } = get();
    if (corners.length < CUSTOM_DOWNLOAD_CORNER_COUNT) return null;
    return boundsFromPoints(corners);
  },

  getPreviewBounds: () => {
    const { corners } = get();
    if (corners.length < 2 || corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT) return null;
    return boundsFromPoints(corners);
  },

  isComplete: () => get().corners.length >= CUSTOM_DOWNLOAD_CORNER_COUNT,
}));
