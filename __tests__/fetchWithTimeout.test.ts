import { fetchWithTimeout } from '../src/lib/network/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  it('uses AbortController fallback when AbortSignal.timeout is unavailable', async () => {
    const originalTimeout = AbortSignal.timeout;
    // @ts-expect-error test shim
    AbortSignal.timeout = undefined;

    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      return Promise.resolve(new Response('ok', { status: 200 }));
    });
    global.fetch = fetchMock as typeof fetch;

    await fetchWithTimeout('https://example.com', { method: 'GET' }, 1000);
    expect(fetchMock).toHaveBeenCalled();

    AbortSignal.timeout = originalTimeout;
  });
});
