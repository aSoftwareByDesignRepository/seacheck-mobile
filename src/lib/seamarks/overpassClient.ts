import { fetchWithTimeout } from '../network/fetchWithTimeout';

/** Public Overpass mirrors — tried in order until one succeeds. */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function isRetryableOverpassError(error: unknown): boolean {
  if (error instanceof Error) {
    if (/overpass_4\d\d/.test(error.message)) return false;
    if (error.name === 'AbortError') return true;
    if (/overpass_(429|5\d\d)/.test(error.message)) return true;
  }
  return true;
}

/** POST an Overpass QL query; tries each mirror before failing. */
export async function fetchOverpass(query: string, timeoutMs: number): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  };

  let lastError: unknown = new Error('overpass_unavailable');

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (response.ok) return response;
      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = new Error(`overpass_${response.status}`);
        continue;
      }
      throw new Error(`overpass_${response.status}`);
    } catch (error) {
      lastError = error;
      if (!isRetryableOverpassError(error)) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('overpass_unavailable');
}
