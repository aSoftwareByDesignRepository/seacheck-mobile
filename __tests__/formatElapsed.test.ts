import { formatElapsedMs } from '../src/lib/time/formatElapsed';

describe('formatElapsedMs', () => {
  it('formats sub-hour elapsed as M:SS', () => {
    expect(formatElapsedMs(134_000)).toBe('2:14');
  });

  it('formats hour-plus elapsed as H:MM:SS', () => {
    expect(formatElapsedMs(3_661_000)).toBe('1:01:01');
  });
});
