import { renderHook, act } from '@testing-library/react-native';

import { useBarometer } from '../src/hooks/useBarometer';

const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn();
const mockSubscribe = jest.fn((listener: (s: unknown) => void) => {
  listener({
    available: true,
    readings: [],
    trend: { currentHpa: 1013, delta3h: null, trend: 'steady' },
    hydrated: true,
  });
  return jest.fn();
});
const mockGetState = jest.fn(() => ({
  available: true,
  readings: [],
  trend: { currentHpa: 1013, delta3h: null, trend: 'steady' },
  hydrated: true,
}));

jest.mock('../src/services/barometerService', () => ({
  getBarometerState: () => mockGetState(),
  startBarometerSampling: () => mockStart(),
  stopBarometerSampling: () => mockStop(),
  subscribeBarometer: (listener: (s: unknown) => void) => mockSubscribe(listener),
}));

describe('useBarometer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not start sampling when disabled', () => {
    const { result } = renderHook(() => useBarometer(false));
    expect(mockStart).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
    expect(result.current.trend.currentHpa).toBeNull();
  });

  it('starts sampling when enabled', () => {
    renderHook(() => useBarometer(true));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('stops sampling when toggled off', () => {
    const { rerender } = renderHook(({ enabled }) => useBarometer(enabled), { initialProps: { enabled: true } });
    expect(mockStart).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(mockStop).toHaveBeenCalled();
  });
});
