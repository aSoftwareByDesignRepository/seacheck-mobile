import { DEV_DOWNLOAD_TIMING, PRODUCTION_DOWNLOAD_TIMING, getDownloadTiming } from '../src/lib/offline/downloadTiming';

describe('downloadTiming', () => {
  it('uses production timings under Jest (NODE_ENV=test)', () => {
    expect(getDownloadTiming()).toEqual(PRODUCTION_DOWNLOAD_TIMING);
  });

  it('dev timings are strictly faster than production', () => {
    expect(DEV_DOWNLOAD_TIMING.initializingTimeoutMs).toBeLessThan(
      PRODUCTION_DOWNLOAD_TIMING.initializingTimeoutMs,
    );
    expect(DEV_DOWNLOAD_TIMING.resumeAtMs[2]).toBeLessThan(PRODUCTION_DOWNLOAD_TIMING.resumeAtMs[2]!);
  });
});
