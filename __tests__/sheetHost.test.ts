import { CONFIRM_SHEET_PRIORITY, createSheetHostStoreForTests } from '../src/ui/sheetHost';

describe('sheetHost store', () => {
  it('picks highest priority entry as top', () => {
    const store = createSheetHostStoreForTests();
    store.register('low', 0, () => null, () => {});
    store.register('high', CONFIRM_SHEET_PRIORITY, () => null, () => {});
    expect(store.getSnapshot().top?.id).toBe('high');
  });

  it('clears top after unregister', () => {
    const store = createSheetHostStoreForTests();
    store.register('a', 0, () => null, () => {});
    store.unregister('a');
    expect(store.getSnapshot().hasEntries).toBe(false);
    expect(store.getSnapshot().top).toBeNull();
  });

  it('invalidate keeps entries registered', () => {
    const store = createSheetHostStoreForTests();
    store.register('a', 0, () => null, () => {});
    expect(store.getSnapshot().hasEntries).toBe(true);
    store.invalidate();
    expect(store.getSnapshot().top?.id).toBe('a');
  });

  it('prefers newer entry at equal priority', () => {
    const store = createSheetHostStoreForTests();
    store.register('first', 0, () => null, () => {});
    store.register('second', 0, () => null, () => {});
    expect(store.getSnapshot().top?.id).toBe('second');
  });
});
