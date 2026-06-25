import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { create } from 'zustand';

export type TabBarSnapshot = Pick<BottomTabBarProps, 'state' | 'descriptors' | 'navigation'>;

type TabOverflowStore = {
  menuOpen: boolean;
  tabBarProps: TabBarSnapshot | null;
  setMenuOpen: (open: boolean) => void;
  syncTabBarProps: (props: TabBarSnapshot) => void;
};

export const useTabOverflowStore = create<TabOverflowStore>((set) => ({
  menuOpen: false,
  tabBarProps: null,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  syncTabBarProps: (tabBarProps) => set({ tabBarProps }),
}));
