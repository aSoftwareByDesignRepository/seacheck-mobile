import { downloadCoordinator, subscribeDownloadCoordinatorActivity } from './downloadCoordinator';
import { useOfflinePackStore } from '../../store/offlinePackStore';

const DEFAULT_TIMEOUT_MS = 45_000;

function isSessionKickedOff(regionId: string): boolean {
  if (downloadCoordinator.isPreflightOnly()) return false;
  if (downloadCoordinator.getActiveRegionId() === regionId && downloadCoordinator.hasActiveDownload()) {
    return true;
  }
  const status = useOfflinePackStore.getState().regions[regionId];
  return status?.state === 'downloading' && !downloadCoordinator.isPreflightOnly();
}

function hasTerminalFailure(regionId: string): boolean {
  return useOfflinePackStore.getState().regions[regionId]?.state === 'error';
}

/**
 * Resolves once the exclusive download session owns GL for `regionId`, or the
 * download promise settles (fast success / failure). Rejects when the promise
 * fails before kickoff, or when kickoff never happens before timeout.
 */
export async function waitForDownloadSessionKickoff(
  regionId: string,
  downloadPromise: Promise<void>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<'started' | 'finished'> {
  if (isSessionKickedOff(regionId)) return 'started';
  if (hasTerminalFailure(regionId)) return 'finished';

  return new Promise<'started' | 'finished'>((resolve, reject) => {
    let settled = false;

    const finish = (result: 'started' | 'finished') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      reject(error);
    };

    const timer = setTimeout(() => {
      if (isSessionKickedOff(regionId)) {
        finish('started');
        return;
      }
      if (hasTerminalFailure(regionId)) {
        finish('finished');
        return;
      }
      fail(new Error('Download session did not start in time'));
    }, timeoutMs);

    const check = () => {
      if (isSessionKickedOff(regionId)) finish('started');
      else if (hasTerminalFailure(regionId)) finish('finished');
    };

    const unsubscribe = subscribeDownloadCoordinatorActivity(check);

    void downloadPromise.then(
      () => finish('finished'),
      (error) => {
        if (hasTerminalFailure(regionId) || isSessionKickedOff(regionId)) {
          finish(hasTerminalFailure(regionId) ? 'finished' : 'started');
          return;
        }
        fail(error);
      },
    );

    // Re-check after subscribe — kickoff may have landed between early return and attach.
    check();
  });
}
