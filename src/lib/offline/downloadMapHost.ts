import type { RefObject } from 'react';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { boundsCenter } from '../map/bounds';

export type DownloadMapController = {
  fitBounds: (bounds: LngLatBounds, zoom: number) => Promise<void>;
  waitForFrame: () => Promise<void>;
};

let styleReady = false;
let styleUri: string | null = null;
let controller: DownloadMapController | null = null;
let styleWaiters: Array<(ready: boolean) => void> = [];
let controllerWaiters: Array<(ready: boolean) => void> = [];
/** Bumped when the visible download map unmounts — stale native callbacks are ignored. */
let downloadMapGeneration = 0;

const isTestEnv = process.env.NODE_ENV === 'test';
const STYLE_WAIT_MS = isTestEnv ? 250 : 25_000;
const CONTROLLER_WAIT_MS = isTestEnv ? 250 : 20_000;
const FRAME_WAIT_MS = isTestEnv ? 0 : 4_000;

function notifyStyleWaiters(ready: boolean): void {
  const waiters = styleWaiters;
  styleWaiters = [];
  waiters.forEach((resolve) => resolve(ready));
}

function notifyControllerWaiters(ready: boolean): void {
  const waiters = controllerWaiters;
  controllerWaiters = [];
  waiters.forEach((resolve) => resolve(ready));
}

export function resetDownloadMapHostForTests(): void {
  styleReady = false;
  styleUri = null;
  controller = null;
  downloadMapGeneration = 0;
  // Resolve pending waits immediately so Jest does not leak 20–25s timers.
  notifyStyleWaiters(false);
  notifyControllerWaiters(false);
}

export function getDownloadMapGeneration(): number {
  return downloadMapGeneration;
}

/** Invalidate callbacks from a map instance that is tearing down. */
export function invalidateDownloadMapGeneration(): number {
  downloadMapGeneration += 1;
  styleReady = false;
  controller = null;
  notifyStyleWaiters(false);
  notifyControllerWaiters(false);
  return downloadMapGeneration;
}

export function markDownloadMapStyleLoaded(uri: string, generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  styleUri = uri;
  styleReady = true;
  notifyStyleWaiters(true);
}

export function markDownloadMapStyleFailed(uri: string, generation = downloadMapGeneration): void {
  if (generation !== downloadMapGeneration) return;
  if (styleUri === uri) {
    styleReady = false;
  }
  notifyStyleWaiters(false);
}

export function registerDownloadMapController(next: DownloadMapController | null): void {
  controller = next;
  notifyControllerWaiters(next != null);
}

export function isDownloadMapReady(): boolean {
  return styleReady && controller != null;
}

export async function waitForDownloadMapReady(
  expectedStyleUri: string,
  timeoutMs = STYLE_WAIT_MS,
): Promise<boolean> {
  if (styleReady && styleUri === expectedStyleUri && controller != null) return true;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      styleWaiters = styleWaiters.filter((w) => w !== onReady);
      controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
      resolve(styleReady && styleUri === expectedStyleUri && controller != null);
    }, timeoutMs);

    const onReady = (ready: boolean) => {
      if (!ready) {
        clearTimeout(timer);
        styleWaiters = styleWaiters.filter((w) => w !== onReady);
        controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
        resolve(false);
        return;
      }
      if (styleReady && styleUri === expectedStyleUri && controller != null) {
        clearTimeout(timer);
        styleWaiters = styleWaiters.filter((w) => w !== onReady);
        controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
        resolve(true);
      }
    };

    styleWaiters.push(onReady);
    controllerWaiters.push(onReady);
  });
}

export async function waitForDownloadMapController(timeoutMs = CONTROLLER_WAIT_MS): Promise<DownloadMapController | null> {
  if (controller) return controller;
  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
      resolve(controller != null);
    }, timeoutMs);
    const onReady = (ok: boolean) => {
      clearTimeout(timer);
      controllerWaiters = controllerWaiters.filter((w) => w !== onReady);
      resolve(ok);
    };
    controllerWaiters.push(onReady);
  });
  return ready ? controller : null;
}

/** Build a camera controller from a MapLibre Camera ref. */
export function createDownloadMapController(cameraRef: RefObject<CameraRef | null>): DownloadMapController {
  return {
    fitBounds: async (bounds, zoom) => {
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const center = boundsCenter(bounds);
      cameraRef.current?.jumpTo({ center: [center.longitude, center.latitude], zoom });
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
    waitForFrame: async () => {
      await new Promise((resolve) => setTimeout(resolve, FRAME_WAIT_MS));
    },
  };
}
