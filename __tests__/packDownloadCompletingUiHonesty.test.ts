import { packStatusLabel } from '../src/features/downloads/packDownloadPresentation';

/**
 * Sweep progress is capped ≤85% in the store. Completing copy at ≥99% is only honest
 * after seal when markReady holds UI at downloading@99% during teardown.
 * If anything else reaches ≥99% while still sweeping, the UI would lie "saving offline".
 */
describe('pack download completing UI honesty', () => {
  it('does not show completing copy for mid-sweep percentages', () => {
    expect(
      packStatusLabel({ state: 'downloading', percentage: 50, error: null, downloadInitializing: false }),
    ).not.toMatch(/saving|completing|Speichern|offline/i);
    expect(
      packStatusLabel({ state: 'downloading', percentage: 85, error: null, downloadInitializing: false }),
    ).not.toBe(packStatusLabel({ state: 'downloading', percentage: 99, error: null, downloadInitializing: false }));
  });

  it('shows completing copy at 99% while state is still downloading (post-seal teardown window)', () => {
    const label = packStatusLabel({
      state: 'downloading',
      percentage: 99,
      error: null,
      downloadInitializing: false,
    });
    expect(label.length).toBeGreaterThan(0);
    // Must differ from ordinary percent progress copy.
    expect(label).not.toMatch(/%/);
  });
});
