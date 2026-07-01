import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

import type { SettingsStackParamList } from './SettingsStack';
import type { PassageStackParamList } from './PassageStack';

export type RootTabParamList = {
  Map: undefined;
  Passage: NavigatorScreenParams<PassageStackParamList> | undefined;
  Tracks: undefined;
  Downloads:
    | {
        focusPackIds?: string[];
        scrollToCustom?: boolean;
        passageBounds?: [number, number, number, number];
        passageName?: string;
      }
    | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type RootTabScreenProps<T extends keyof RootTabParamList> = BottomTabScreenProps<RootTabParamList, T>;

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
};
