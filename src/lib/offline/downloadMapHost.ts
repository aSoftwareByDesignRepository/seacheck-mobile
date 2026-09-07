import type { RefObject } from 'react';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { boundsCenter } from '../map/bounds';
import { clearDownloadMapStickyHost } from './downloadMapSlot';

export type DownloadMapController = {
  /** Jump to a single tile center/zoom so that tile (+ style overlays) actually render. */
  showTile: (center: [number, number], zoom: number) => Promise<void>;
  fitBounds: (bounds: LngLatBounds, zoom: number) => Promise<void>;
  /**
   * Wait until at least `minFrames` full paint events after registration.
   * Production `DownloadMapEngine` counts real MapLibre frames; the camera-only
   * fallback sleeps a fixed budget so callers never hang without a surface.
   */
  waitForFrame: (minFrames?: number) => Promise<void>;
  /** Generation at register time — sweep ignores controllers from dead map instances. */
  generation?: number;
};

let styleReady = false;
let styleUri: string | null = null;
let controller: DownloadMapController | null = null;
let frameRendered = false;
let styleWaiters: Array<(ready: boolean) => void> = [];
let controllerWaiters: Array<(ready: boolean) => void> = [];
/** Bumped when the visible download map unmounts or a new exclusive session starts. */
let downloadMapGeneration = 0;
const generationListeners = new Set<() => void>();
/** Diagnostics for failure reports (no PII). */
let engineMountCount = 0;
let lastStyleMarkGeneration = -1;
let lastFrameMarkGeneration = -1;

const isTestEnv = process.env.NODE_ENV === 'test';
const STYLE_WAIT_MS = isTestEnv ? 250 : 45_000;
const CONTROLLER_WAIT_MS = isTestEnv ? 250 : 20_000;
const FRAME_WAIT_MS = isTestEnv ? 0 : 4_000;

function isFullyReady(expectedStyleUri?: string): boolean {
  if (!styleReady || controller == null || !frameRendered) return false;
  if (expectedStyleUri != null && styleUri !== expectedStyleUri) return false;
  return true;
}

function notifyGenerationListeners(): void {
  generationListeners.forEach((listener) => listener());
}

/**
 * Notify waiters without clearing the lists.
 * Transient `false` (remount / generation bump) must leave waiters registered so they
 * can still observe the next successful ready — clearing on false caused DOWNLOAD_MAP_NOT_READY.
 * Each waiter removes itself when it settles (timeout or true).
 */
function notifyReadyWaiters(ready: boolean): void {
  const style = [...styleWaiters];
  const ctrl = [...controllerWaiters];
  style.forEach((resolve) => resolve(ready));
  ctrl.forEach((resolve) => resolve(ready));
}

function clearReadyWaiters(): void {
  styleWaiters = [];
  controllerWaiters = [];
}

export function resetDownloadMapHostForTests(): void {
  styleReady = false;
  styleUri = null;
  controller = null;
  frameRendered = false;
  downloadMapGeneration = 0;
  generationListeners.clear();
  engineMountCount = 0;
  lastStyleMarkGeneration = -1;
  lastFrameMarkGeneration = -1;
  clearReadyWaiters();
}

/** Clear stale callbacks before a new exclusive download session. */
export function resetDownloadMapSession(): void {
  invalidateDownloadMapGeneration();
  styleUri = null;
  clearDownloadMapStickyHost();
}

/** End sticky GL ownership after seal/teardown/cancel so the next download can pick a host. */
export function endDownloadMapSessionOwnership(): void {
  clearDownloadMapStickyHost();
}

export function getDownloadMapGeneration(): number {
  return downloadMapGeneration;
}

/** Subscribe to generation bumps so DownloadMapEngine can remount with a fresh GL surface. */
export function subscribeDownloadMapGeneration(listener: () => void): () => void {
  generationListeners.add(listener);
  return () => generationListeners.delete(listener);
}

/** Invalidate callbacks from a map instance that is tearing down or a new session. */
export function invalidateDownloadMapGeneration(): number {
  downloadMapGeneration += 1;
  styleReady = false;
  frameRendered = false;
  controller = null;
  notifyReadyWaiters(false);
  notifyGenerationListeners();
  return downloadMapGeneration;
}

export function markDownloadMapStyleLoaded(uri: string, generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  styleUri = uri;
  styleReady = true;
  lastStyleMarkGeneration = generation;
  if (frameRendered && controller != null) {
    notifyReadyWaiters(true);
  }
}

export function markDownloadMapFrameRendered(generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  frameRendered = true;
  lastFrameMarkGeneration = generation;
  if (styleReady && controller != null) {
    notifyReadyWaiters(true);
  }
}

/** Called when DownloadMapEngine mounts a MapLibre surface. */
export function noteDownloadMapEngineMounted(generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  engineMountCount += 1;
}

export function getDownloadMapHostDiagnostics(): {
  generation: number;
  styleReady: boolean;
  frameRendered: boolean;
  hasController: boolean;
  styleUriPresent: boolean;
  engineMountCount: number;
  lastStyleMarkGeneration: number;
  lastFrameMarkGeneration: number;
} {
  return {
    generation: downloadMapGeneration,
    styleReady,
    frameRendered,
    hasController: controller != null,
    styleUriPresent: styleUri != null,
    engineMountCount,
    lastStyleMarkGeneration,
    lastFrameMarkGeneration,
  };
}

export function markDownloadMapStyleFailed(uri: string, generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  if (styleUri === uri) {
    styleReady = false;
    frameRendered = false;
  }
  notifyReadyWaiters(false);
}

export function registerDownloadMapController(next: DownloadMapController | null): void {
  controller = next;
  if (next != null && styleReady && frameRendered) {
    notifyReadyWaiters(true);
  } else if (next == null) {
    notifyReadyWaiters(false);
  }
}

export function isDownloadMapReady(): boolean {
  return isFullyReady();
}

export function isDownloadMapStyleLoaded(expectedStyleUri: string): boolean {
  return isFullyReady(expectedStyleUri);
}

/**
 * Wait until the visible download map has style + controller + at least one frame.
 * Transient `false` notifies (remount / generation bump) do NOT abort — only timeout does.
 * Waiters stay registered across remounts until they settle.
 */
export async function waitForDownloadMapReady(
  expectedStyleUri: string,
  timeoutMs = STYLE_WAIT_MS,
): Promise<boolean> {
  if (isFullyReady(expectedStyleUri)) return true;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      styleWaiters = styleWaiters.filter((w) => w !== onReady);
      controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
      resolve(ok);
    };

    const timer = setTimeout(() => {
      finish(isFullyReady(expectedStyleUri));
    }, timeoutMs);

    const onReady = (ready: boolean) => {
      if (!ready) {
        // Remount / invalidate — stay registered for the next successful ready.
        return;
      }
      if (isFullyReady(expectedStyleUri)) {
        finish(true);
      }
      // Ready notify for a different style — stay registered.
    };

    styleWaiters.push(onReady);
    controllerWaiters.push(onReady);
  });
}

export async function waitForDownloadMapController(timeoutMs = CONTROLLER_WAIT_MS): Promise<DownloadMapController | null> {
  if (controller) return controller;
  const ready = await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      finish(controller != null);
    }, timeoutMs);
    const onReady = (ok: boolean) => {
      if (!ok) return; // transient clear — keep waiting
      if (controller != null) finish(true);
    };
    controllerWaiters.push(onReady);
  });
  return ready ? controller : null;
}

/** Build a camera controller from a MapLibre Camera ref. */
export function createDownloadMapController(cameraRef: RefObject<CameraRef | null>): DownloadMapController {
  const generation = downloadMapGeneration;
  return {
    generation,
    showTile: async (center, zoom) => {
      if (generation !== downloadMapGeneration) return;
      cameraRef.current?.jumpTo({ center, zoom });
      // No fixed dwell — callers wait on real paint frames via waitForFrame.
    },
    fitBounds: async (bounds, zoom) => {
      if (generation !== downloadMapGeneration) return;
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
      });
      const center = boundsCenter(bounds);
      cameraRef.current?.jumpTo({ center: [center.longitude, center.latitude], zoom });
    },
    waitForFrame: async (minFrames = 1) => {
      if (generation !== downloadMapGeneration) return;
      const frames = Math.max(1, Math.floor(minFrames));
      // Fallback when Engine does not wrap this controller: budget scales with frames.
      await new Promise((resolve) => setTimeout(resolve, FRAME_WAIT_MS * frames));
    },
  };
}

export function isLiveDownloadMapController(candidate: DownloadMapController | null): candidate is DownloadMapController {
  if (candidate == null) return false;
  if (candidate.generation != null && candidate.generation !== downloadMapGeneration) return false;
  if (controller != null && controller !== candidate) return false;
  return true;
}
