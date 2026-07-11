import {
  resolveBgLocationModeFromFlags,
  type BgLocationMode,
} from '../src/services/backgroundLocationService';

describe('resolveBgLocationModeFromFlags', () => {
  it('prioritizes MOB safety mode', () => {
    expect(
      resolveBgLocationModeFromFlags({
        mob: true,
        anchor: true,
        passage: true,
        goTo: true,
        track: true,
      }),
    ).toBe('safety_mob');
  });

  it('collapses anchor, passage, and go-to into shared safety mode', () => {
    const cases: Array<[Partial<Record<keyof Parameters<typeof resolveBgLocationModeFromFlags>[0], boolean>>, BgLocationMode]> = [
      [{ mob: false, anchor: true, passage: false, goTo: false, track: false }, 'safety'],
      [{ mob: false, anchor: false, passage: true, goTo: false, track: false }, 'safety'],
      [{ mob: false, anchor: false, passage: false, goTo: true, track: false }, 'safety'],
    ];
    for (const [flags, expected] of cases) {
      expect(
        resolveBgLocationModeFromFlags({
          mob: false,
          anchor: false,
          passage: false,
          goTo: false,
          track: false,
          ...flags,
        }),
      ).toBe(expected);
    }
  });

  it('uses track mode only when no safety scenario is active', () => {
    expect(
      resolveBgLocationModeFromFlags({
        mob: false,
        anchor: false,
        passage: false,
        goTo: false,
        track: true,
      }),
    ).toBe('track');
  });

  it('returns null when nothing needs background GPS', () => {
    expect(
      resolveBgLocationModeFromFlags({
        mob: false,
        anchor: false,
        passage: false,
        goTo: false,
        track: false,
      }),
    ).toBeNull();
  });
});
