import type { LayoutChangeEvent } from 'react-native';

import { readLayout, readLayoutHeight, readLayoutY } from '../src/lib/ui/safeLayout';

function layoutEvent(
  layout: { x: number; y: number; width: number; height: number } | null,
): LayoutChangeEvent {
  return { nativeEvent: { layout } } as LayoutChangeEvent;
}

describe('safeLayout', () => {
  it('returns null when nativeEvent is missing', () => {
    expect(readLayout({} as LayoutChangeEvent)).toBeNull();
    expect(readLayoutY({} as LayoutChangeEvent)).toBeNull();
    expect(readLayoutHeight({} as LayoutChangeEvent)).toBeNull();
  });

  it('returns null when layout is null', () => {
    expect(readLayout(layoutEvent(null))).toBeNull();
  });

  it('reads finite layout values', () => {
    const event = layoutEvent({ x: 1, y: 24, width: 320, height: 48 });
    expect(readLayout(event)).toEqual({ x: 1, y: 24, width: 320, height: 48 });
    expect(readLayoutY(event)).toBe(24);
    expect(readLayoutHeight(event)).toBe(48);
  });

  it('rejects non-finite numbers', () => {
    const event = layoutEvent({ x: 0, y: NaN, width: 100, height: 40 });
    expect(readLayout(event)).toBeNull();
  });
});
