import {
  assertChartTileReachability,
  resetChartTileProbeCacheForTests,
} from '../src/lib/network/chartTileReachability';
import { MIN_VALID_CHART_TILE_BYTES } from '../src/lib/map/chartTileQuality';

function mockTileResponse(status: number, bodyBytes = MIN_VALID_CHART_TILE_BYTES) {
  const body = new Uint8Array(bodyBytes);
  return {
    status,
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

describe('assertChartTileReachability', () => {
  beforeEach(() => {
    resetChartTileProbeCacheForTests();
  });

  it('accepts successful GET probes for base and seamark tiles', async () => {
    const fetchFn = jest.fn(async () => mockTileResponse(206));
    await expect(assertChartTileReachability(fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0]?.[0]).toContain('tile.openstreetmap.org');
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Range: 'bytes=0-511',
        'User-Agent': expect.stringMatching(/^SeaCheck\//),
      }),
    });
    expect(fetchFn.mock.calls[1]?.[0]).toContain('tiles.openseamap.org/seamark/');
  });

  it('retries transient server errors before failing', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce(mockTileResponse(200))
      .mockResolvedValueOnce(mockTileResponse(200));
    await expect(assertChartTileReachability(fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('rejects server errors after retries are exhausted', async () => {
    const fetchFn = jest.fn(async () => ({ status: 503 }));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/temporarily unavailable/i);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('rejects hard client errors on the base host', async () => {
    const fetchFn = jest.fn(async () => ({ status: 403 }));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/Cannot reach chart tile servers/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects HTTP 416 — Range Not Satisfiable is not proof tiles work', async () => {
    const fetchFn = jest.fn(async () => mockTileResponse(416, 0));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/Cannot reach chart tile servers/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects 416 on seamark — do not green-light empty Range failures', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(mockTileResponse(200))
      .mockResolvedValueOnce(mockTileResponse(416, 0));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/seamark tile servers/i);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects placeholder base tiles even when HTTP status is 200', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(mockTileResponse(200, 103))
      .mockResolvedValueOnce(mockTileResponse(200, 103))
      .mockResolvedValueOnce(mockTileResponse(200, 103))
      .mockResolvedValueOnce(mockTileResponse(200));
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/Cannot reach chart tile servers/i);
  });

  it('accepts small seamark tiles (empty overlay is valid)', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(mockTileResponse(200))
      .mockResolvedValueOnce(mockTileResponse(200, 334));
    await expect(assertChartTileReachability(fetchFn)).resolves.toBeUndefined();
  });

  it('rejects seamark failures with a seamark-specific message', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(mockTileResponse(200))
      .mockResolvedValueOnce({ status: 403 });
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/seamark tile servers/i);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects timeouts with a clear message', async () => {
    const fetchFn = jest.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    await expect(assertChartTileReachability(fetchFn)).rejects.toThrow(/did not respond in time/i);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('caches a recent successful probe', async () => {
    const fetchFn = jest.fn(async () => mockTileResponse(200));
    await assertChartTileReachability(fetchFn);
    await assertChartTileReachability(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cache for a different probe center', async () => {
    const fetchFn = jest.fn(async () => mockTileResponse(200));
    const north = { latitude: 54.32, longitude: 10.15 };
    const south = { latitude: 36.5, longitude: -5.5 };
    await assertChartTileReachability(fetchFn, north);
    await assertChartTileReachability(fetchFn, south);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('reuses cache for the same probe center within the TTL', async () => {
    const fetchFn = jest.fn(async () => mockTileResponse(200));
    const center = { latitude: 54.32, longitude: 10.15 };
    await assertChartTileReachability(fetchFn, center);
    await assertChartTileReachability(fetchFn, { latitude: 54.324, longitude: 10.148 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
