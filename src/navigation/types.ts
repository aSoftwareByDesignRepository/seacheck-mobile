import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Map: undefined;
  Passage: undefined;
  Waypoints: undefined;
  Tracks: undefined;
  Downloads:
    | {
        focusPackIds?: string[];
        scrollToCustom?: boolean;
        passageBounds?: [number, number, number, number];
        passageName?: string;
      }
    | undefined;
  Settings: undefined;
};

export type RootTabScreenProps<T extends keyof RootTabParamList> = BottomTabScreenProps<RootTabParamList, T>;

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
};
