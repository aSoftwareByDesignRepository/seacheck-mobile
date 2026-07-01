import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useNavigationStore } from '../store/navigationStore';
import { radius, sheet, typography } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

/** Global confirms sit above ordinary sheets in the single modal host. */
export const CONFIRM_SHEET_PRIORITY = 1000;

/** Anchor-watch guidance sits above routine map tool sheets. */
export const ANCHOR_WATCH_SHEET_PRIORITY = 100;

/** Global feedback overlays open sheets without replacing them. */
export const FEEDBACK_SHEET_ID = '__global_feedback__';

/** Ignore backdrop / back dismiss briefly after open — avoids the opening tap closing the sheet. */
export const SHEET_BACKDROP_GUARD_MS = 400;

type SheetHostEntry = {
  id: string;
  priority: number;
  sequence: number;
  openedAt: number;
  onClose: () => void;
  render: () => ReactNode;
};

type SheetHostSnapshot = {
  top: SheetHostEntry | null;
  /** Highest-priority sheet excluding the feedback overlay entry. */
  sheetTop: SheetHostEntry | null;
  feedback: SheetHostEntry | null;
  hasEntries: boolean;
};

type SheetHostApi = {
  register: (id: string, priority: number, render: () => ReactNode, onClose: () => void) => void;
  update: (id: string, render: () => ReactNode, onClose: () => void) => void;
  invalidate: () => void;
  unregister: (id: string) => void;
  /** Closes every registered sheet — used when the screen lock engages. */
  dismissAll: () => void;
};

const SheetHostContext = createContext<SheetHostApi | null>(null);

/** Backdrop dismiss — guarded; explicit close buttons call onClose directly. */
const SheetBackdropDismissContext = createContext<(() => void) | null>(null);

function pickTop(entries: Map<string, SheetHostEntry>, excludeId?: string): SheetHostEntry | null {
  let top: SheetHostEntry | null = null;
  for (const entry of entries.values()) {
    if (excludeId && entry.id === excludeId) continue;
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

  let snapshot: SheetHostSnapshot = { top: null, sheetTop: null, feedback: null, hasEntries: false };

  function emit() {
    const feedback = entries.get(FEEDBACK_SHEET_ID) ?? null;
    snapshot = {
      top: pickTop(entries),
      sheetTop: pickTop(entries, FEEDBACK_SHEET_ID),
      feedback,
      hasEntries: entries.size > 0,
    };
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
      entries.set(id, { id, priority, sequence, openedAt: Date.now(), render, onClose });
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
    dismissAll() {
      if (entries.size === 0) return;
      const closers = [...entries.values()].map((entry) => entry.onClose);
      entries.clear();
      emit();
      for (const close of closers) {
        close();
      }
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
      dismissAll: () => store.dismissAll(),
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

export function useSheetHostSnapshotPublic(): SheetHostSnapshot {
  return useSheetHostSnapshot();
}

function SheetHostModal() {
  const { sheetTop, feedback, hasEntries } = useSheetHostSnapshot();
  const screenLocked = useNavigationStore((s) => s.screenLocked);

  const requestBackdropDismiss = useCallback(() => {
    if (!sheetTop) return;
    if (Date.now() - sheetTop.openedAt < SHEET_BACKDROP_GUARD_MS) return;
    sheetTop.onClose();
  }, [sheetTop]);

  if (!hasEntries || screenLocked) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={requestBackdropDismiss}
      statusBarTranslucent
    >
      {sheetTop ? (
        <SheetBackdropDismissContext.Provider value={requestBackdropDismiss}>
          {sheetTop.render()}
        </SheetBackdropDismissContext.Provider>
      ) : null}
      {feedback ? (
        <View style={styles.feedbackOverlay} pointerEvents="box-none">
          {feedback.render()}
        </View>
      ) : null}
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
  const { height: windowHeight } = useWindowDimensions();
  const backdropDismiss = useContext(SheetBackdropDismissContext) ?? onClose;
  const maxSheetHeight = Math.round(windowHeight * 0.88);

  const header = (
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
  );

  return (
    <Pressable
      style={styles.backdrop}
      onPress={backdropDismiss}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
            maxHeight: maxSheetHeight,
          },
        ]}
        onStartShouldSetResponder={() => true}
        accessibilityViewIsModal
        testID={testID}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no" />
        {header}
        {scrollable ? (
          <ScrollView
            style={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: spacing.sm, gap: spacing.sm }}
          >
            {children}
            {footer ? <View style={{ marginTop: spacing.md, gap: spacing.sm }}>{footer}</View> : null}
          </ScrollView>
        ) : (
          <>
            {children}
            {footer ? <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>{footer}</View> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

/** Standard dismiss button row for detail sheets. */
export function SheetDismissFooter({ onClose, testID }: { onClose: () => void; testID?: string }) {
  const { minTouch } = useTheme();
  return <Button label={t('common.close')} variant="ghost" onPress={onClose} testID={testID} style={{ minHeight: minTouch }} />;
}

const styles = StyleSheet.create({
  feedbackOverlay: { ...StyleSheet.absoluteFill, zIndex: 2, elevation: 12 },
  backdrop: { flex: 1, backgroundColor: sheet.backdrop, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    width: '100%',
    flexShrink: 1,
  },
  scrollBody: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
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
