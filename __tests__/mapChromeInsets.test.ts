import { mapChromeInsets, MAP_EDGE_MIN } from '../src/features/map/mapChromeInsets';

describe('mapChromeInsets', () => {
  it('adds minimum edge padding beyond safe area', () => {
    const chrome = mapChromeInsets({ top: 24, right: 0, bottom: 0, left: 0 }, 12);
    expect(chrome.top).toBe(24 + MAP_EDGE_MIN);
    expect(chrome.right).toBe(MAP_EDGE_MIN);
    expect(chrome.left).toBe(MAP_EDGE_MIN);
  });

  it('respects notched device insets', () => {
    const chrome = mapChromeInsets({ top: 44, right: 34, bottom: 34, left: 34 }, 16);
    expect(chrome.right).toBe(34 + 16);
    expect(chrome.left).toBe(34 + 16);
  });
});
