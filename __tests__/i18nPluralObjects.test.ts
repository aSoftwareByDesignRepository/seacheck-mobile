import { i18n, t } from '../src/i18n';

/**
 * Lazy "(s)" plural tails were replaced by real i18n-js plural objects
 * (Atlas 2026-10-24 l10n sweep). Pin: t(key, {count}) picks the right form
 * and never renders the "(s)" hack in any locale.
 */
describe('passage plural keys render real plural forms', () => {
  const KEYS = [
    'passage.offlineGaps',
    'passage.offlineLegStatusSummary',
    'passage.remainingLegsAfterPacks',
    'passage.downloadAllProgress',
    'passage.suggestionLegs',
  ];

  afterEach(() => {
    i18n.locale = 'en';
  });

  it('en singular vs plural', () => {
    i18n.locale = 'en';
    expect(t('passage.offlineGaps', { count: 1 })).toBe('1 leg not fully covered');
    expect(t('passage.offlineGaps', { count: 3 })).toBe('3 legs not fully covered');
    expect(t('passage.suggestionLegs', { count: 1 })).toBe('Helps with 1 leg');
    expect(t('passage.suggestionLegs', { count: 4 })).toBe('Helps with 4 legs');
  });

  it('de singular vs plural (Etappe/Etappen)', () => {
    i18n.locale = 'de';
    expect(t('passage.offlineGaps', { count: 1 })).toContain('Etappe ');
    expect(t('passage.offlineGaps', { count: 1 })).not.toContain('Etappen');
    expect(t('passage.offlineGaps', { count: 2 })).toContain('Etappen');
  });

  it('no locale still renders the "(s)" lazy tail', () => {
    for (const locale of ['en', 'de', 'fr', 'es', 'it', 'da', 'nl', 'sv', 'nb', 'pt', 'pl']) {
      i18n.locale = locale;
      for (const key of KEYS) {
        const out = t(key, { count: 2, covered: 1, total: 3, gaps: 2 });
        expect(out).not.toMatch(/\w\(\w*\)/);
        expect(out).not.toMatch(/\[missing/);
      }
    }
  });
});
