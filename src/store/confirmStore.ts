import { create } from 'zustand';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type QueuedConfirm = {
  req: ConfirmRequest;
  resolve: (value: boolean) => void;
};

type ConfirmState = ConfirmRequest & {
  visible: boolean;
  requestConfirm: (req: ConfirmRequest) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
  /** Cancel visible + every queued waiter (ConfirmSheet unmount / host teardown). */
  cancelAllPending: () => void;
};

const EMPTY_CONFIRM: ConfirmRequest = {
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: undefined,
  destructive: false,
};

let activeResolve: ((value: boolean) => void) | null = null;
const queue: QueuedConfirm[] = [];

function showNext(set: (partial: Partial<ConfirmState>) => void) {
  const next = queue.shift();
  if (!next) {
    set({ visible: false, ...EMPTY_CONFIRM });
    return;
  }
  activeResolve = next.resolve;
  set({
    visible: true,
    title: next.req.title,
    message: next.req.message,
    confirmLabel: next.req.confirmLabel,
    cancelLabel: next.req.cancelLabel,
    destructive: next.req.destructive ?? false,
  });
}

function drainAllAsCancelled(set: (partial: Partial<ConfirmState>) => void) {
  if (activeResolve) {
    activeResolve(false);
    activeResolve = null;
  }
  while (queue.length > 0) {
    queue.shift()!.resolve(false);
  }
  set({ visible: false, ...EMPTY_CONFIRM });
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  visible: false,
  ...EMPTY_CONFIRM,
  requestConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      if (activeResolve) {
        queue.push({ req, resolve });
        return;
      }
      activeResolve = resolve;
      set({
        visible: true,
        title: req.title,
        message: req.message,
        confirmLabel: req.confirmLabel,
        cancelLabel: req.cancelLabel,
        destructive: req.destructive ?? false,
      });
    }),
  resolveConfirm: (confirmed) => {
    activeResolve?.(confirmed);
    activeResolve = null;
    showNext(set);
  },
  cancelAllPending: () => {
    drainAllAsCancelled(set);
  },
}));

/** Async confirm dialog — replaces Alert.alert for in-app decisions. */
export function requestConfirm(req: ConfirmRequest): Promise<boolean> {
  return useConfirmStore.getState().requestConfirm(req);
}

/** Fail-close every waiter — used when ConfirmSheet / host unmounts. */
export function cancelAllPendingConfirms(): void {
  useConfirmStore.getState().cancelAllPending();
}

/** @internal test helper */
export function resetConfirmStoreForTests() {
  cancelAllPendingConfirms();
}
