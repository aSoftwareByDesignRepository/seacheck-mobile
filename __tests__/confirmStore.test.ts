import { requestConfirm, resetConfirmStoreForTests, useConfirmStore } from '../src/store/confirmStore';

describe('confirmStore', () => {
  afterEach(() => {
    resetConfirmStoreForTests();
  });

  it('queues confirm requests instead of cancelling the active dialog', async () => {
    const first = requestConfirm({
      title: 'First',
      message: 'One',
      confirmLabel: 'OK',
    });
    const second = requestConfirm({
      title: 'Second',
      message: 'Two',
      confirmLabel: 'OK',
    });

    expect(useConfirmStore.getState().title).toBe('First');

    useConfirmStore.getState().resolveConfirm(true);
    expect(await first).toBe(true);
    expect(useConfirmStore.getState().title).toBe('Second');

    useConfirmStore.getState().resolveConfirm(false);
    expect(await second).toBe(false);
    expect(useConfirmStore.getState().visible).toBe(false);
  });

  it('cancelAllPending fails closed for visible + queued waiters (ConfirmSheet unmount)', async () => {
    const first = requestConfirm({
      title: 'First',
      message: 'One',
      confirmLabel: 'OK',
    });
    const second = requestConfirm({
      title: 'Second',
      message: 'Two',
      confirmLabel: 'OK',
    });
    const third = requestConfirm({
      title: 'Third',
      message: 'Three',
      confirmLabel: 'OK',
    });

    expect(useConfirmStore.getState().visible).toBe(true);
    useConfirmStore.getState().cancelAllPending();

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    await expect(third).resolves.toBe(false);
    expect(useConfirmStore.getState().visible).toBe(false);
    expect(useConfirmStore.getState().title).toBe('');
  });

  it('resolveConfirm(false) alone would resurface a queued confirm (lock must drain instead)', async () => {
    // Documents the race ScreenLockCoordinator / backdrop onClose must avoid:
    // calling only resolveConfirm(false) promotes the next waiter to visible=true.
    const first = requestConfirm({
      title: 'First',
      message: 'One',
      confirmLabel: 'OK',
    });
    const second = requestConfirm({
      title: 'Second',
      message: 'Two',
      confirmLabel: 'OK',
    });

    useConfirmStore.getState().resolveConfirm(false);
    await expect(first).resolves.toBe(false);
    expect(useConfirmStore.getState().visible).toBe(true);
    expect(useConfirmStore.getState().title).toBe('Second');

    useConfirmStore.getState().cancelAllPending();
    await expect(second).resolves.toBe(false);
    expect(useConfirmStore.getState().visible).toBe(false);
  });
});
