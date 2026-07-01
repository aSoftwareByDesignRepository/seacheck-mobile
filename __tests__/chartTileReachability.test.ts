import {
  assertChartTileReachability,
  resetChartTileProbeCacheForTests,
} from '../src/lib/network/chartTileReachability';

describe('assertChartTileReachability', () => {
  beforeEach(() => {
    resetChartTileProbeCacheForTests();
  });

  it('accepts a successful HEAD probe', async () => {
    const fetchFn = jest.fn(async () => ({ status: 200 }));
    await expect(assertChartTileReachability(fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('basemaps.cartocdn.com/rastertiles/voyager/'),
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('falls back to GET when HEAD is not allowed', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ status: 405 })
      .mockResolvedValueOnce({ status: 206 });
    await expect(assertChartTileReachability(fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({
      method: 'GET',
      headers: { Range: 'bytes=0-511' },
    });
  });

  it('rejects server errors with a clear message', async () => {
    const fetchFn = jest.fn(async () => ({ status: 503 }));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/temporarily unavailable/i);
  });

  it('rejects timeouts with a clear message', async () => {
    const fetchFn = jest.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/did not respond in time/i);
  });

  it('caches a recent successful probe', async () => {
    const fetchFn = jest.fn(async () => ({ status: 200 }));
    await assertChartTileReachability(fetchFn);
    await assertChartTileReachability(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
