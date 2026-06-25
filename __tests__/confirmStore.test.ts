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
});
