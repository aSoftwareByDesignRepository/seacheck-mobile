import { create } from 'zustand';

export type FeedbackKind = 'success' | 'error' | 'info';

type FeedbackState = {
  message: string | null;
  kind: FeedbackKind | null;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  clear: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

const ERROR_DISMISS_MS = 20_000;
const TOAST_MS = 4500;

function showMessage(kind: FeedbackKind, message: string, set: (partial: Partial<FeedbackState>) => void) {
  if (hideTimer) clearTimeout(hideTimer);
  set({ message, kind });
  const timeout = kind === 'error' ? ERROR_DISMISS_MS : TOAST_MS;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    set({ message: null, kind: null });
  }, timeout);
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  message: null,
  kind: null,
  showSuccess: (message) => showMessage('success', message, set),
  showError: (message) => showMessage('error', message, set),
  showInfo: (message) => showMessage('info', message, set),
  clear: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ message: null, kind: null });
  },
}));
