import type { LayoutChangeEvent } from 'react-native';

/** RN 0.70+ Android may emit onLayout with nativeEvent null after unmount — never destructure blindly. */
export function readLayout(event: LayoutChangeEvent | null | undefined): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const layout = event?.nativeEvent?.layout;
  if (!layout) return null;
  const { x, y, width, height } = layout;
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  return { x, y, width, height };
}

export function readLayoutY(event: LayoutChangeEvent): number | null {
  return readLayout(event)?.y ?? null;
}

export function readLayoutHeight(event: LayoutChangeEvent): number | null {
  return readLayout(event)?.height ?? null;
}

export function onLayoutY(handler: (y: number) => void): (event: LayoutChangeEvent) => void {
  return (event) => {
    const y = readLayoutY(event);
    if (y != null) handler(y);
  };
}

export function onLayoutHeight(handler: (height: number) => void): (event: LayoutChangeEvent) => void {
  return (event) => {
    const height = readLayoutHeight(event);
    if (height != null) handler(height);
  };
}
