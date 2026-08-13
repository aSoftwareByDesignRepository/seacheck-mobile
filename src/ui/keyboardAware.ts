import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  findNodeHandle,
  Keyboard,
  Platform,
  TextInput,
  type KeyboardEvent,
  type ScrollView,
} from 'react-native';

/** Keep the focused field clear of the keyboard / caret chrome. */
export const KEYBOARD_FOCUS_MARGIN = 24;

/**
 * Content bottom padding while the soft keyboard is visible.
 * iOS + automaticallyAdjustKeyboardInsets: keep base only (no double pad).
 * Android: large cushion so multiline notes can scroll clear of the IME.
 */
export function keyboardContentPadding(
  basePadding: number,
  keyboardHeight: number,
  opts: { platform: string; automaticallyAdjustsInsets: boolean },
): number {
  const base = Number.isFinite(basePadding) ? Math.max(0, basePadding) : 0;
  const height = Number.isFinite(keyboardHeight) ? Math.max(0, keyboardHeight) : 0;
  if (height <= 0) {
    return base;
  }
  if (opts.platform === 'ios' && opts.automaticallyAdjustsInsets) {
    return base;
  }
  if (opts.platform === 'android') {
    const cushion = Math.min(height, Math.max(160, Math.round(height * 0.85)));
    return base + cushion;
  }
  const cushion = Math.min(height, Math.max(120, Math.round(height * 0.25)));
  return base + cushion;
}

export function scrollOffsetForFocusedField(
  fieldY: number,
  margin: number = KEYBOARD_FOCUS_MARGIN,
): number {
  const y = Number.isFinite(fieldY) ? fieldY : 0;
  const m = Number.isFinite(margin) ? margin : KEYBOARD_FOCUS_MARGIN;
  return Math.max(0, y - m);
}

function currentlyFocusedInput(): {
  measureLayout: (
    relativeTo: number,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail: () => void,
  ) => void;
} | null {
  const state = TextInput.State as
    | {
        currentlyFocusedInput?: () => unknown;
        currentlyFocusedField?: () => unknown;
      }
    | undefined;
  const node =
    (typeof state?.currentlyFocusedInput === 'function'
      ? state.currentlyFocusedInput()
      : null) ??
    (typeof state?.currentlyFocusedField === 'function' ? state.currentlyFocusedField() : null);
  if (!node || typeof (node as { measureLayout?: unknown }).measureLayout !== 'function') {
    return null;
  }
  return node as {
    measureLayout: (
      relativeTo: number,
      onSuccess: (x: number, y: number, width: number, height: number) => void,
      onFail: () => void,
    ) => void;
  };
}

export function scrollFocusedInputIntoView(
  scrollRef: RefObject<ScrollView | null>,
  marginTop: number = KEYBOARD_FOCUS_MARGIN,
): void {
  const scroll = scrollRef.current;
  if (!scroll) {
    return;
  }
  const focused = currentlyFocusedInput();
  if (!focused) {
    return;
  }
  const scrollHandle = findNodeHandle(scroll);
  if (scrollHandle == null) {
    return;
  }
  focused.measureLayout(
    scrollHandle,
    (_x, y) => {
      if (scrollRef.current !== scroll) {
        return;
      }
      scroll.scrollTo({ y: scrollOffsetForFocusedField(y, marginTop), animated: true });
    },
    () => {},
  );
}

export type KeyboardAwareScrollApi = {
  scrollRef: RefObject<ScrollView | null>;
  keyboardPad: number;
  onScrollViewLayout: () => void;
  scrollProps: {
    ref: RefObject<ScrollView | null>;
    keyboardShouldPersistTaps: 'handled';
    keyboardDismissMode: 'interactive' | 'on-drag';
    automaticallyAdjustKeyboardInsets: true;
    onContentSizeChange: () => void;
  };
};

/**
 * Soft-keyboard avoidance for Screen ScrollViews (time-entry notes, forms).
 * Do not wrap with KeyboardAvoidingView(padding) when using automaticallyAdjustKeyboardInsets —
 * that double-pads on iOS.
 *
 * Reveal runs after keyboard-height state commits (and retries) so paddingBottom
 * exists before scroll-into-view — otherwise Android leaves the note under the IME
 * with no remaining scroll range.
 */
export function useKeyboardAwareScroll(_baseBottomPadding: number): KeyboardAwareScrollApi {
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const revealFocused = useCallback(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!alive.current) {
          return;
        }
        scrollFocusedInputIntoView(scrollRef);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const next = e.endCoordinates?.height ?? 0;
      const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
      keyboardHeightRef.current = safe;
      setKeyboardHeight(safe);
    };
    const onHide = () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0) {
      return undefined;
    }
    let cancel = revealFocused();
    const t1 = setTimeout(() => {
      cancel?.();
      cancel = revealFocused();
    }, 48);
    const t2 = setTimeout(() => {
      cancel?.();
      cancel = revealFocused();
    }, 160);
    return () => {
      cancel?.();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [keyboardHeight, revealFocused]);

  const keyboardPad = keyboardContentPadding(0, keyboardHeight, {
    platform: Platform.OS,
    automaticallyAdjustsInsets: true,
  });

  const onContentSizeChange = useCallback(() => {
    if (keyboardHeightRef.current > 0) {
      revealFocused();
    }
  }, [revealFocused]);

  return {
    scrollRef,
    keyboardPad,
    onScrollViewLayout: revealFocused,
    scrollProps: {
      ref: scrollRef,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'on-drag',
      automaticallyAdjustKeyboardInsets: true,
      onContentSizeChange,
    },
  };
}
