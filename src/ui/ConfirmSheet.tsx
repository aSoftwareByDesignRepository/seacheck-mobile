import { useEffect } from 'react';
import { View } from 'react-native';

import { t } from '../i18n';
import { useConfirmStore } from '../store/confirmStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';
import { BottomSheetChrome, CONFIRM_SHEET_PRIORITY, useSheetHost } from './sheetHost';

const CONFIRM_HOST_ID = 'global-confirm';

/** Global confirm UI — shares the single SheetHost modal with all BottomSheets. */
export function ConfirmSheet() {
  const { spacing } = useTheme();
  const { register, unregister } = useSheetHost();
  const visible = useConfirmStore((s) => s.visible);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const cancelLabel = useConfirmStore((s) => s.cancelLabel);
  const destructive = useConfirmStore((s) => s.destructive);
  const resolveConfirm = useConfirmStore((s) => s.resolveConfirm);

  useEffect(() => {
    if (!visible) {
      unregister(CONFIRM_HOST_ID);
      return;
    }

    const frame = requestAnimationFrame(() => {
      register(
        CONFIRM_HOST_ID,
        CONFIRM_SHEET_PRIORITY,
        () => (
          <BottomSheetChrome
            onClose={() => resolveConfirm(false)}
            title={title}
            subtitle={message}
            testID="confirm.sheet"
            footer={
              <View style={{ gap: spacing.sm }}>
                <Button
                  label={confirmLabel}
                  variant={destructive ? 'danger' : 'primary'}
                  onPress={() => resolveConfirm(true)}
                  testID="confirm.proceed"
                />
                <Button
                  label={cancelLabel ?? t('common.dismiss')}
                  variant="ghost"
                  onPress={() => resolveConfirm(false)}
                  testID="confirm.cancel"
                />
              </View>
            }
          />
        ),
        () => resolveConfirm(false),
      );
    });

    return () => {
      cancelAnimationFrame(frame);
      unregister(CONFIRM_HOST_ID);
    };
  }, [
    visible,
    register,
    unregister,
    title,
    message,
    confirmLabel,
    cancelLabel,
    destructive,
    resolveConfirm,
    spacing.sm,
  ]);

  return null;
}
