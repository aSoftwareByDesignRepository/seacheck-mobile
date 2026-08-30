import {
  keyboardContentPadding,
  resolveFocusedTextInput,
  scrollFocusedInputIntoView,
  scrollOffsetForFocusedField,
} from '../src/ui/keyboardAware';

describe('keyboardContentPadding', () => {
  it('returns base when keyboard height is 0 / non-finite', () => {
    expect(
      keyboardContentPadding(16, 0, { platform: 'android', automaticallyAdjustsInsets: true }),
    ).toBe(16);
    expect(
      keyboardContentPadding(16, Number.NaN, { platform: 'android', automaticallyAdjustsInsets: true }),
    ).toBe(16);
  });

  it('does not double-pad iOS when automaticallyAdjustKeyboardInsets is on', () => {
    expect(
      keyboardContentPadding(20, 300, { platform: 'ios', automaticallyAdjustsInsets: true }),
    ).toBe(20);
  });

  it('adds Android IME cushion while keyboard is open', () => {
    const pad = keyboardContentPadding(12, 280, {
      platform: 'android',
      automaticallyAdjustsInsets: true,
    });
    expect(pad).toBeGreaterThan(12);
    expect(pad).toBeLessThanOrEqual(12 + 280);
  });
});

describe('scrollOffsetForFocusedField', () => {
  it('keeps the focused field above the margin', () => {
    expect(scrollOffsetForFocusedField(100, 24)).toBe(76);
    expect(scrollOffsetForFocusedField(10, 24)).toBe(0);
    expect(scrollOffsetForFocusedField(Number.NaN, 24)).toBe(0);
  });
});

describe('resolveFocusedTextInput', () => {
  it('uses currentlyFocusedInput and never touches currentlyFocusedField', () => {
    const measureLayout = jest.fn();
    const currentlyFocusedField = jest.fn(() => 42);
    const currentlyFocusedInput = jest.fn(() => ({ measureLayout }));
    const state = { currentlyFocusedInput, currentlyFocusedField };

    const node = resolveFocusedTextInput(state);

    expect(node).toEqual({ measureLayout });
    expect(currentlyFocusedInput).toHaveBeenCalledTimes(1);
    expect(currentlyFocusedField).not.toHaveBeenCalled();
  });

  it('returns null when currentlyFocusedInput is missing or not measurable', () => {
    expect(resolveFocusedTextInput(undefined)).toBeNull();
    expect(resolveFocusedTextInput({})).toBeNull();
    expect(resolveFocusedTextInput({ currentlyFocusedInput: () => null })).toBeNull();
    // Deprecated API shape: numeric handle — must not be treated as measurable.
    expect(resolveFocusedTextInput({ currentlyFocusedInput: () => 99 })).toBeNull();
  });
});

describe('scrollFocusedInputIntoView', () => {
  it('no-ops when scroll ref or focused input is missing', () => {
    const scrollTo = jest.fn();
    scrollFocusedInputIntoView({ current: null });
    expect(scrollTo).not.toHaveBeenCalled();

    scrollFocusedInputIntoView({ current: { scrollTo } as never });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
