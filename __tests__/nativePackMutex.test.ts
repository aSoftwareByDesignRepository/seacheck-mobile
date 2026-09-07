import {
  isNativePackOpBusy,
  resetNativePackMutexForTests,
  withNativePackOp,
} from '../src/lib/offline/nativePackMutex';
import {
  downloadCoordinator,
  resetDownloadCoordinatorForTests,
} from '../src/lib/offline/downloadCoordinator';

describe('nativePackMutex', () => {
  beforeEach(() => {
    resetNativePackMutexForTests();
    resetDownloadCoordinatorForTests();
  });

  it('serializes overlapping ops (second waits for first)', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withNativePackOp(async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
      return 1;
    });
    const second = withNativePackOp(async () => {
      order.push('second');
      return 2;
    });

    await Promise.resolve();
    expect(isNativePackOpBusy()).toBe(true);
    expect(downloadCoordinator.tryBegin('kiel-bay')).toBeNull();

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
    expect(isNativePackOpBusy()).toBe(false);
    expect(downloadCoordinator.tryBegin('kiel-bay')).toBe(1);
  });
});
