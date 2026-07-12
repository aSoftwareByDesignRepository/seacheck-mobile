import {
  hasExclusiveChartDownloadMap,
  isDownloadMapSessionActive,
} from '../src/features/downloads/packDownloadPresentation';

describe('exclusive chart download session', () => {
  it('is active while downloading or completing (ready + coordinator lock)', () => {
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'downloading' }, 'kiel-bay', null)).toBe(true);
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'ready' }, 'kiel-bay', null)).toBe(true);
  });

  it('stays active during post-session map teardown', () => {
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'ready' }, null, 'kiel-bay')).toBe(true);
    expect(hasExclusiveChartDownloadMap(null, 'kiel-bay')).toBe(true);
  });

  it('is inactive after the session and teardown end', () => {
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'ready' }, null, null)).toBe(false);
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'idle' }, 'kiel-bay', null)).toBe(false);
    expect(isDownloadMapSessionActive('kiel-bay', { state: 'downloading' }, 'other', null)).toBe(false);
    expect(hasExclusiveChartDownloadMap(null, null)).toBe(false);
  });
});
