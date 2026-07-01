import { create } from 'zustand';

type DownloadFailureStore = {
  visible: boolean;
  title: string;
  summary: string;
  report: string;
  show: (opts: { title: string; summary: string; report: string }) => void;
  dismiss: () => void;
};

export const useDownloadFailureStore = create<DownloadFailureStore>((set) => ({
  visible: false,
  title: '',
  summary: '',
  report: '',
  show: ({ title, summary, report }) => set({ visible: true, title, summary, report }),
  dismiss: () => set({ visible: false, title: '', summary: '', report: '' }),
}));
