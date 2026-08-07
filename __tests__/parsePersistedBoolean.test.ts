import { parsePersistedBoolean } from '../src/lib/settings/parsePersistedBoolean';

describe('parsePersistedBoolean', () => {
  it('returns booleans unchanged', () => {
    expect(parsePersistedBoolean(true, false)).toBe(true);
    expect(parsePersistedBoolean(false, true)).toBe(false);
  });

  it('falls back for non-boolean persisted values', () => {
    expect(parsePersistedBoolean(undefined, true)).toBe(true);
    expect(parsePersistedBoolean('false', true)).toBe(true);
    // String "false" must not become true via Boolean(value) — use fallback.
    expect(parsePersistedBoolean('false', false)).toBe(false);
    expect(parsePersistedBoolean(0, false)).toBe(false);
    expect(parsePersistedBoolean(1, false)).toBe(false);
  });
});
