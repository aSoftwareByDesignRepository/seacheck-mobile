import {
  OfflineManager,
  type LngLatBounds,
  type OfflinePack,
  type OfflinePackCreateOptions,
  type OfflinePackErrorListener,
  type OfflinePackProgressListener,
  type OfflinePackStatus,
} from '@maplibre/maplibre-react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { startDownloadStallWatchdog } from './downloadStallWatchdog';
import { recreateOfflinePack } from './nativePackRecovery';
import { pollNativePackStatus } from './nativePackStatus';
import {
  ensureOfflineMapEngineReadyForDownload,
  offlineEngineViewportFromBounds,
  type OfflineEngineViewport,
} from './offlineMapEngineHost';
import { warmupOfflineEngine } from './warmupOfflineEngine';

export type SealDurableOfflinePackArgs = {
  regionId: string;
  session: number;
  chartStyleUri: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
  metadata?: Record<string, unknown>;
  stallMessage: string;
  mapEngineStallMessage: string;
  isCancelled: () => boolean;
  isNativeDownloadComplete: (status: OfflinePackStatus | null | undefined) => boolean;
  kickstartNativeDownload: (
    pack: OfflinePack,
    chartStyleUri?: string,
    isSessionActive?: () => boolean,
    viewport?: OfflineEngineViewport,
    bounds?: LngLatBounds,
  ) => Promise<OfflinePackStatus>;
  /** Fired as soon as createPack returns so the index can store a durable pack id. */
  onPackCreated: (pack: OfflinePack) => void | Promise<void>;
  onProgress: (pack: OfflinePack, status: OfflinePackStatus) => void;
};

type WaitArgs = {
  regionId: string;
  session: number;
  chartStyleUri: string;
  stallMessage: string;
  mapEngineStallMessage: string;
  viewport: OfflineEngineViewport;
  createOptions: OfflinePackCreateOptions;
  isCancelled: () => boolean;
  isNativeDownloadComplete: (status: OfflinePackStatus | null | undefined) => boolean;
  kickstartNativeDownload: SealDurableOfflinePackArgs['kickstartNativeDownload'];
  onProgress: (pack: OfflinePack, status: OfflinePackStatus) => void;
  onPackReplaced?: (pack: OfflinePack) => void | Promise<void>;
};

async function waitUntilNativePackComplete(
  initialPack: OfflinePack,
  args: WaitArgs,
): Promise<string> {
  let settled = false;
  let activePack = initialPack;
  let stopWatchdog: () => void = () => {};
  let resolveDone: (() => void) | null = null;
  let rejectDone: ((error: Error) => void) | null = null;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    stopWatchdog();
    resolveDone?.();
  };
  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    stopWatchdog();
    rejectDone?.(new Error(message));
  };

  const onProgress: OfflinePackProgressListener = (pack, status) => {
    if (args.isCancelled() || settled) return;
    activePack = pack;
    args.onProgress(pack, status);
    if (args.isNativeDownloadComplete(status)) finish();
  };
  const onError: OfflinePackErrorListener = (_pack, error) => {
    fail(error.message || 'NATIVE_PACK_ERROR');
  };

  try {
    await OfflineManager.addListener(activePack.id, onProgress, onError);
  } catch {
    /* createPack / prior listeners may already be wired */
  }

  const kickstarted = await args.kickstartNativeDownload(
    activePack,
    args.chartStyleUri,
    () => !args.isCancelled() && !settled,
    args.viewport,
    args.createOptions.bounds,
  );
  if (args.isCancelled()) throw new Error('DOWNLOAD_CANCELLED');
  args.onProgress(activePack, kickstarted);
  if (args.isNativeDownloadComplete(kickstarted) || settled) {
    finish();
    return activePack.id;
  }

  stopWatchdog = startDownloadStallWatchdog(
    args.regionId,
    args.session,
    activePack,
    (message) => fail(message),
    args.stallMessage,
    (status) => {
      if (settled || args.isCancelled()) return;
      args.onProgress(activePack, status);
      if (args.isNativeDownloadComplete(status)) finish();
    },
    {
      chartStyleUri: args.chartStyleUri,
      mapEngineStallMessage: args.mapEngineStallMessage,
      viewport: args.viewport,
      onRecreatePack: async (currentPack) => {
        const replacement = await recreateOfflinePack(
          currentPack,
          args.createOptions,
          onProgress,
          onError,
          () => !args.isCancelled(),
        );
        if (replacement?.id) {
          activePack = replacement;
          await args.onPackReplaced?.(replacement);
        }
        return replacement;
      },
    },
  );

  const cancelPoll = setInterval(() => {
    if (!settled && args.isCancelled()) {
      fail('DOWNLOAD_CANCELLED');
    }
  }, 250);

  try {
    await done;
    if (args.isCancelled()) throw new Error('DOWNLOAD_CANCELLED');
    return activePack.id;
  } finally {
    clearInterval(cancelPoll);
    stopWatchdog();
  }
}

/**
 * Pins swept tiles into a MapLibre OfflineManager region (outside ambient LRU).
 * Ready must only be claimed after this completes.
 */
export async function sealDurableOfflinePack(args: SealDurableOfflinePackArgs): Promise<string> {
  const viewport = offlineEngineViewportFromBounds(args.bounds, args.minZoom);
  await warmupOfflineEngine(args.chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
  await ensureOfflineMapEngineReadyForDownload(args.chartStyleUri, viewport, args.bounds);
  if (args.isCancelled()) {
    throw new Error('DOWNLOAD_CANCELLED');
  }

  const createOptions: OfflinePackCreateOptions = {
    mapStyle: args.chartStyleUri,
    bounds: args.bounds,
    minZoom: args.minZoom,
    maxZoom: args.maxZoom,
    metadata: {
      regionId: args.regionId,
      minZoom: args.minZoom,
      maxZoom: args.maxZoom,
      ...args.metadata,
    },
  };

  let settledEarly = false;
  let createError: Error | null = null;
  const onProgress: OfflinePackProgressListener = (pack, status) => {
    if (args.isCancelled() || settledEarly) return;
    args.onProgress(pack, status);
    if (args.isNativeDownloadComplete(status)) settledEarly = true;
  };
  const onError: OfflinePackErrorListener = (_pack, error) => {
    createError = new Error(error.message || 'NATIVE_PACK_ERROR');
  };

  ensureMapLibreNetworkForDownload();
  const pack = await OfflineManager.createPack(createOptions, onProgress, onError);
  if (createError) throw createError;
  if (!pack?.id) {
    throw new Error('NATIVE_PACK_CREATE_FAILED');
  }

  await args.onPackCreated(pack);
  if (args.isCancelled()) {
    throw new Error('DOWNLOAD_CANCELLED');
  }

  const immediate = await pollNativePackStatus(pack);
  if (immediate) args.onProgress(pack, immediate);
  if (args.isNativeDownloadComplete(immediate) || settledEarly) {
    return pack.id;
  }

  return waitUntilNativePackComplete(pack, {
    regionId: args.regionId,
    session: args.session,
    chartStyleUri: args.chartStyleUri,
    stallMessage: args.stallMessage,
    mapEngineStallMessage: args.mapEngineStallMessage,
    viewport,
    createOptions,
    isCancelled: args.isCancelled,
    isNativeDownloadComplete: args.isNativeDownloadComplete,
    kickstartNativeDownload: args.kickstartNativeDownload,
    onProgress: args.onProgress,
    onPackReplaced: args.onPackCreated,
  });
}

/** Resume an incomplete native OfflineManager pack after process death. */
export async function resumeDurableOfflinePack(args: {
  pack: OfflinePack;
  regionId: string;
  session: number;
  chartStyleUri: string;
  bounds: LngLatBounds;
  minZoom: number;
  stallMessage: string;
  mapEngineStallMessage: string;
  createOptions: OfflinePackCreateOptions;
  isCancelled: () => boolean;
  isNativeDownloadComplete: (status: OfflinePackStatus | null | undefined) => boolean;
  kickstartNativeDownload: SealDurableOfflinePackArgs['kickstartNativeDownload'];
  onPackReplaced?: (pack: OfflinePack) => void | Promise<void>;
  onProgress: (pack: OfflinePack, status: OfflinePackStatus) => void;
}): Promise<string> {
  const viewport = offlineEngineViewportFromBounds(args.bounds, args.minZoom);
  return waitUntilNativePackComplete(args.pack, {
    regionId: args.regionId,
    session: args.session,
    chartStyleUri: args.chartStyleUri,
    stallMessage: args.stallMessage,
    mapEngineStallMessage: args.mapEngineStallMessage,
    viewport,
    createOptions: args.createOptions,
    isCancelled: args.isCancelled,
    isNativeDownloadComplete: args.isNativeDownloadComplete,
    kickstartNativeDownload: args.kickstartNativeDownload,
    onProgress: args.onProgress,
    onPackReplaced: args.onPackReplaced,
  });
}
