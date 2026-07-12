import { parsePersistedBoolean } from '../src/lib/settings/parsePersistedBoolean';

describe('parsePersistedBoolean', () => {
  it('returns booleans unchanged', () => {
    expect(parsePersistedBoolean(true, false)).toBe(true);
    expect(parsePersistedBoolean(false, true)).toBe(false);
  });

  it('falls back for non-boolean persisted values', () => {
    expect(parsePersistedBoolean(undefined, true)).toBe(true);
    expect(parsePersistedBoolean('false', true)).toBe(true);
    expect(parsePersistedBoolean(0, false)).toBe(false);
  });
});
