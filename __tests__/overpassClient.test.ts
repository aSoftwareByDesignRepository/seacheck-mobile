import { fetchOverpass, OVERPASS_ENDPOINTS } from '../src/lib/seamarks/overpassClient';

describe('fetchOverpass', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns first successful mirror response', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url === OVERPASS_ENDPOINTS[0]) {
        return new Response(JSON.stringify({ elements: [] }), { status: 503 });
      }
      return new Response(JSON.stringify({ elements: [{ id: 1 }] }), { status: 200 });
    }) as typeof fetch;

    const response = await fetchOverpass('[out:json];node(1);out;', 1000);
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when all mirrors fail', async () => {
    global.fetch = jest.fn(async () => new Response('busy', { status: 503 })) as typeof fetch;

    await expect(fetchOverpass('[out:json];node(1);out;', 1000)).rejects.toThrow(/overpass_503/);
    expect(global.fetch).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length);
  });

  it('does not retry on client errors', async () => {
    global.fetch = jest.fn(async () => new Response('bad query', { status: 400 })) as typeof fetch;

    await expect(fetchOverpass('[out:json];node(1);out;', 1000)).rejects.toThrow(/overpass_400/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
