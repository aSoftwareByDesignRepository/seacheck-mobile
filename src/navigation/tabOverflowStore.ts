import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { create } from 'zustand';

type TabOverflowStore = {
  menuOpen: boolean;
  tabBarProps: BottomTabBarProps | null;
  setMenuOpen: (open: boolean) => void;
  syncTabBarProps: (props: BottomTabBarProps) => void;
};

export const useTabOverflowStore = create<TabOverflowStore>((set) => ({
  menuOpen: false,
  tabBarProps: null,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  syncTabBarProps: (tabBarProps) => set({ tabBarProps }),
}));
