import NetInfo from '@react-native-community/netinfo';

import { ensureDownloadAllowed } from '../src/lib/network/downloadPolicy';
import { requestConfirm } from '../src/store/confirmStore';
import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('../src/store/confirmStore', () => ({
  requestConfirm: jest.fn(),
}));

describe('ensureDownloadAllowed', () => {
  const fetchNet = NetInfo.fetch as jest.Mock;
  const confirm = requestConfirm as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ downloadWifiOnly: true });
    confirm.mockResolvedValue(true);
  });

  it('allows immediately when Wi‑Fi-only is disabled', async () => {
    useSettingsStore.setState({ downloadWifiOnly: false });
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: true });
    expect(fetchNet).not.toHaveBeenCalled();
  });

  it('allows on wifi without prompting', async () => {
    fetchNet.mockResolvedValue({ isConnected: true, type: 'wifi' });
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: true });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('allows on ethernet without prompting', async () => {
    fetchNet.mockResolvedValue({ isConnected: true, type: 'ethernet' });
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: true });
  });

  it('blocks when the device reports no connection (does not show cellular dialog)', async () => {
    fetchNet.mockResolvedValue({ isConnected: false, type: 'none' });
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: false, reason: 'offline' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks for confirmation on cellular and respects cancel', async () => {
    fetchNet.mockResolvedValue({ isConnected: true, type: 'cellular' });
    confirm.mockResolvedValueOnce(false);
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: false, reason: 'cancelled' });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation on cellular and respects proceed', async () => {
    fetchNet.mockResolvedValue({ isConnected: true, type: 'cellular' });
    confirm.mockResolvedValueOnce(true);
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: true });
  });

  it('does not silently allow downloads when NetInfo throws — asks the user', async () => {
    fetchNet.mockRejectedValue(new Error('netinfo dead'));
    confirm.mockResolvedValueOnce(false);
    await expect(ensureDownloadAllowed()).resolves.toEqual({ ok: false, reason: 'cancelled' });
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
