import { CONFIRM_SHEET_PRIORITY, createSheetHostStoreForTests, FEEDBACK_SHEET_ID } from '../src/ui/sheetHost';

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
    const before = store.getSnapshot();
    store.invalidate();
    const after = store.getSnapshot();
    expect(after.hasEntries).toBe(true);
    expect(after.top?.id).toBe('a');
    expect(after).not.toBe(before);
  });

  it('prefers newer entry at equal priority', () => {
    const store = createSheetHostStoreForTests();
    store.register('first', 0, () => null, () => {});
    store.register('second', 0, () => null, () => {});
    expect(store.getSnapshot().top?.id).toBe('second');
  });

  it('keeps sheetTop when feedback overlay is registered', () => {
    const store = createSheetHostStoreForTests();
    store.register('tools', 0, () => null, () => {});
    store.register(FEEDBACK_SHEET_ID, 0, () => null, () => {});
    const snap = store.getSnapshot();
    expect(snap.sheetTop?.id).toBe('tools');
    expect(snap.feedback?.id).toBe(FEEDBACK_SHEET_ID);
    expect(snap.top?.id).toBe(FEEDBACK_SHEET_ID);
  });
});
