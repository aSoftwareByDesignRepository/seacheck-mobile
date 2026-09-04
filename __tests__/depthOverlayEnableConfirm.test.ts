import { confirmEnableDepthOverlay } from '../src/lib/settings/depthOverlayEnableConfirm';
import { requestConfirm } from '../src/store/confirmStore';

jest.mock('../src/store/confirmStore', () => ({
  requestConfirm: jest.fn(),
}));

jest.mock('../src/i18n', () => ({
  t: (key: string) => key,
}));

describe('confirmEnableDepthOverlay', () => {
  const confirm = requestConfirm as jest.MockedFunction<typeof requestConfirm>;

  beforeEach(() => {
    confirm.mockReset();
  });

  it('returns true when the skipper confirms', async () => {
    confirm.mockResolvedValue(true);
    await expect(confirmEnableDepthOverlay()).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'settings.depthOverlayConfirmTitle',
        confirmLabel: 'settings.depthOverlayConfirmEnable',
        cancelLabel: 'common.cancel',
        destructive: false,
      }),
    );
  });

  it('returns false when cancelled — overlay must stay off', async () => {
    confirm.mockResolvedValue(false);
    await expect(confirmEnableDepthOverlay()).resolves.toBe(false);
  });
});
