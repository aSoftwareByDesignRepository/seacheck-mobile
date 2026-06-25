import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { radius, sheet, typography } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

/** Global confirms sit above ordinary sheets in the single modal host. */
export const CONFIRM_SHEET_PRIORITY = 1000;

/** Ignore backdrop / back dismiss briefly after open — avoids the opening tap closing the sheet. */
export const SHEET_BACKDROP_GUARD_MS = 400;

type SheetHostEntry = {
  id: string;
  priority: number;
  sequence: number;
  onClose: () => void;
  render: () => ReactNode;
};

type SheetHostSnapshot = {
  top: SheetHostEntry | null;
  hasEntries: boolean;
};

type SheetHostApi = {
  register: (id: string, priority: number, render: () => ReactNode, onClose: () => void) => void;
  update: (id: string, render: () => ReactNode, onClose: () => void) => void;
  invalidate: () => void;
  unregister: (id: string) => void;
};

const SheetHostContext = createContext<SheetHostApi | null>(null);

/** Backdrop dismiss — guarded; explicit close buttons call onClose directly. */
const SheetBackdropDismissContext = createContext<(() => void) | null>(null);

function pickTop(entries: Map<string, SheetHostEntry>): SheetHostEntry | null {
  let top: SheetHostEntry | null = null;
  for (const entry of entries.values()) {
    if (
      !top ||
      entry.priority > top.priority ||
      (entry.priority === top.priority && entry.sequence > top.sequence)
    ) {
      top = entry;
    }
  }
  return top;
}

function createSheetHostStore() {
  let entries = new Map<string, SheetHostEntry>();
  let sequence = 0;
  const listeners = new Set<() => void>();

  const snapshot: SheetHostSnapshot = { top: null, hasEntries: false };

  function emit() {
    snapshot.top = pickTop(entries);
    snapshot.hasEntries = entries.size > 0;
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    register(id: string, priority: number, render: () => ReactNode, onClose: () => void) {
      sequence += 1;
      entries.set(id, { id, priority, sequence, render, onClose });
      emit();
    },
    update(id: string, render: () => ReactNode, onClose: () => void) {
      const entry = entries.get(id);
      if (!entry) return;
      entries.set(id, { ...entry, render, onClose });
      emit();
    },
    invalidate() {
      if (entries.size === 0) return;
      emit();
    },
    unregister(id: string) {
      if (!entries.delete(id)) return;
      emit();
    },
  };
}

type SheetHostStore = ReturnType<typeof createSheetHostStore>;

const SheetHostStoreContext = createContext<SheetHostStore | null>(null);

export function SheetHostProvider({ children }: PropsWithChildren) {
  const storeRef = useRef<SheetHostStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createSheetHostStore();
  }
  const store = storeRef.current;

  const api = useMemo<SheetHostApi>(
    () => ({
      register: (id, priority, render, onClose) => store.register(id, priority, render, onClose),
      update: (id, render, onClose) => store.update(id, render, onClose),
      invalidate: () => store.invalidate(),
      unregister: (id) => store.unregister(id),
    }),
    [store],
  );

  return (
    <SheetHostStoreContext.Provider value={store}>
      <SheetHostContext.Provider value={api}>
        {children}
        <SheetHostModal />
      </SheetHostContext.Provider>
    </SheetHostStoreContext.Provider>
  );
}

export function useSheetHost(): SheetHostApi {
  const ctx = useContext(SheetHostContext);
  if (!ctx) {
    throw new Error('useSheetHost requires SheetHostProvider');
  }
  return ctx;
}

function useSheetHostSnapshot(): SheetHostSnapshot {
  const store = useContext(SheetHostStoreContext);
  if (!store) {
    throw new Error('useSheetHostSnapshot requires SheetHostProvider');
  }
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function SheetHostModal() {
  const { top, hasEntries } = useSheetHostSnapshot();
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (top) openedAtRef.current = Date.now();
  }, [top?.id, top?.sequence]);

  const requestBackdropDismiss = useCallback(() => {
    if (!top) return;
    if (Date.now() - openedAtRef.current < SHEET_BACKDROP_GUARD_MS) return;
    top.onClose();
  }, [top]);

  if (!hasEntries || !top) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={requestBackdropDismiss}
      statusBarTranslucent
    >
      <SheetBackdropDismissContext.Provider value={requestBackdropDismiss}>
        {top.render()}
      </SheetBackdropDismissContext.Provider>
    </Modal>
  );
}

export type BottomSheetChromeProps = PropsWithChildren<{
  onClose: () => void;
  title: string;
  subtitle?: string;
  scrollable?: boolean;
  testID?: string;
  footer?: ReactNode;
}>;

/** Shared sheet chrome — rendered inside the single SheetHost modal. */
export function BottomSheetChrome({
  onClose,
  title,
  subtitle,
  scrollable = false,
  testID,
  footer,
  children,
}: BottomSheetChromeProps) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const backdropDismiss = useContext(SheetBackdropDismissContext) ?? onClose;

  const body = (
    <>
      <View style={[styles.header, { marginBottom: spacing.md }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          accessibilityHint={t('ui.sheetCloseHint')}
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeBtn, { minHeight: minTouch, minWidth: minTouch, borderColor: colors.border }]}
          testID={testID ? `${testID}.close` : undefined}
        >
          <Text style={[styles.closeLabel, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
      </View>
      {children}
      {footer ? <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>{footer}</View> : null}
    </>
  );

  return (
    <Pressable
      style={styles.backdrop}
      onPress={backdropDismiss}
      accessibilityRole="button"
      accessibilityLabel={t('common.dismiss')}
      accessibilityHint={t('ui.sheetBackdropHint')}
    >
      <Pressable
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        onPress={(e) => e.stopPropagation()}
        accessibilityViewIsModal
        testID={testID}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no" />
        {scrollable ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </Pressable>
    </Pressable>
  );
}

/** Standard dismiss button row for detail sheets. */
export function SheetDismissFooter({ onClose, testID }: { onClose: () => void; testID?: string }) {
  const { minTouch } = useTheme();
  return <Button label={t('common.close')} variant="ghost" onPress={onClose} testID={testID} style={{ minHeight: minTouch }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: sheet.backdrop, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    maxHeight: sheet.maxHeight,
  },
  handle: {
    alignSelf: 'center',
    width: sheet.handleWidth,
    height: sheet.handleHeight,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.sheetTitle },
  subtitle: { ...typography.sheetSubtitle, marginTop: 4 },
  closeBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
});

/** @internal Test hook — create an isolated sheet host store. */
export function createSheetHostStoreForTests() {
  return createSheetHostStore();
}
