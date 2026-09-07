import {
  clearDownloadMapStickyHost,
  getDownloadMapStickyHostForTests,
  resetDownloadMapSlotForTests,
  resolveDownloadMapSlot,
  setDownloadMapDownloadsClaim,
  setDownloadMapMapClaim,
} from '../src/lib/offline/downloadMapSlot';

describe('downloadMapSlot', () => {
  beforeEach(() => {
    resetDownloadMapSlotForTests();
  });

  it('uses Map as the only sticky visible host', () => {
    expect(resolveDownloadMapSlot()).toBe('corner');
    setDownloadMapDownloadsClaim(true);
    expect(resolveDownloadMapSlot()).toBe('corner');
    setDownloadMapMapClaim(true);
    expect(resolveDownloadMapSlot()).toBe('map');
    expect(getDownloadMapStickyHostForTests()).toBe('map');
    setDownloadMapMapClaim(false);
    // Sticky keeps Map ownership across blur so the GL surface does not remount.
    expect(resolveDownloadMapSlot()).toBe('map');
    clearDownloadMapStickyHost();
    expect(resolveDownloadMapSlot()).toBe('corner');
  });

  it('beginDownloadMapMapOwnership claims before React mounts', () => {
    const { beginDownloadMapMapOwnership } = require('../src/lib/offline/downloadMapSlot') as typeof import('../src/lib/offline/downloadMapSlot');
    beginDownloadMapMapOwnership();
    expect(resolveDownloadMapSlot()).toBe('map');
    expect(getDownloadMapStickyHostForTests()).toBe('map');
  });
});
