import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PassageDetailScreen } from '../screens/passage/PassageDetailScreen';
import { PassageListScreen } from '../screens/passage/PassageListScreen';
import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

export type PassageStackParamList = {
  PassageList: undefined;
  PassageDetail: { passageId: string };
};

const Stack = createNativeStackNavigator<PassageStackParamList>();

export function PassageStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen
        name="PassageList"
        component={PassageListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PassageDetail"
        component={PassageDetailScreen}
        options={{ title: t('passage.detailTitle') }}
      />
    </Stack.Navigator>
  );
}
