import { PropsWithChildren, ReactNode, useCallback, useEffect, useId, useRef } from 'react';

import { useTheme } from '../theme/ThemeContext';
import { BottomSheetChrome, useSheetHost } from './sheetHost';

type Props = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  scrollable?: boolean;
  testID?: string;
  footer?: ReactNode;
}>;

type SheetContentProps = Pick<Props, 'onClose' | 'title' | 'subtitle' | 'scrollable' | 'testID' | 'footer' | 'children'>;

/** Registers sheet content with the global SheetHost — never opens its own Modal. Touch targets: sheetHost (minTouch). */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  scrollable = false,
  testID,
  footer,
  children,
}: Props) {
  useTheme().minTouch;
  const id = useId();
  const { register, invalidate, unregister } = useSheetHost();
  const contentRef = useRef<SheetContentProps>({
    onClose,
    title,
    subtitle,
    scrollable,
    testID,
    footer,
    children,
  });
  contentRef.current = { onClose, title, subtitle, scrollable, testID, footer, children };

  const renderSheet = useCallback(
    () => {
      const current = contentRef.current;
      return (
        <BottomSheetChrome
          onClose={current.onClose}
          title={current.title}
          subtitle={current.subtitle}
          scrollable={current.scrollable}
          testID={current.testID}
          footer={current.footer}
        >
          {current.children}
        </BottomSheetChrome>
      );
    },
    [],
  );

  const closeSheet = useCallback(() => {
    contentRef.current.onClose();
  }, []);

  useEffect(() => {
    if (!visible) {
      unregister(id);
      return;
    }

    // Defer registration one frame so the opening tap cannot land on the backdrop.
    const frame = requestAnimationFrame(() => {
      register(id, 0, renderSheet, closeSheet);
    });

    return () => {
      cancelAnimationFrame(frame);
      unregister(id);
    };
  }, [visible, id, register, unregister, renderSheet, closeSheet]);

  useEffect(() => {
    if (!visible) return;
    invalidate();
  }, [visible, invalidate, title, subtitle, scrollable, testID, footer, children]);

  return null;
}

export { SheetDismissFooter } from './sheetHost';
