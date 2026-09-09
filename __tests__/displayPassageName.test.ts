import { applyLocalePreference, initI18n } from '../src/i18n';
import { displayPassageName } from '../src/lib/passage/displayPassageName';

describe('displayPassageName', () => {
  beforeAll(() => {
    initI18n();
  });

  afterEach(async () => {
    await applyLocalePreference('en');
  });

  it('localizes English stock title when UI locale is DE', async () => {
    await applyLocalePreference('de');
    expect(displayPassageName('New passage')).toBe('Neue Passage');
  });

  it('keeps custom names unchanged', async () => {
    await applyLocalePreference('de');
    expect(displayPassageName('Kiel → Laboe')).toBe('Kiel → Laboe');
  });

  it('falls back to current-locale default for empty names', async () => {
    await applyLocalePreference('de');
    expect(displayPassageName('')).toBe('Neue Passage');
    expect(displayPassageName(null)).toBe('Neue Passage');
  });
});
