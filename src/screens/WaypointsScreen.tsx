import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCoordinates } from '../map/coords';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { useSettingsStore } from '../store/settingsStore';
import type { WaypointRow } from '../lib/db/database';
import { useNavigationStore, waypointToTarget } from '../store/navigationStore';
import { useWaypointStore } from '../store/waypointStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';
import { StatusBadge } from '../ui/StatusBadge';

export function WaypointsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const items = useWaypointStore((s) => s.items);
  const remove = useWaypointStore((s) => s.remove);
  const create = useWaypointStore((s) => s.create);
  const setGoTo = useNavigationStore((s) => s.setGoTo);
  const [busy, setBusy] = useState(false);

  const addDemo = useCallback(async () => {
    setBusy(true);
    try {
      await create({ name: 'Kiel harbour', latitude: 54.323, longitude: 10.141, type: 'harbour' });
    } finally {
      setBusy(false);
    }
  }, [create]);

  function confirmDelete(item: WaypointRow) {
    Alert.alert(t('waypoints.deleteTitle'), item.name, [
      { text: t('common.dismiss'), style: 'cancel' },
      { text: t('waypoints.delete'), style: 'destructive', onPress: () => void remove(item.id) },
    ]);
  }

  if (items.length === 0) {
    return (
      <Screen testID="screen.waypoints" title={t('tabs.waypoints')}>
        <EmptyState
          testID="waypoints.empty"
          icon="place"
          title={t('waypoints.emptyTitle')}
          body={t('waypoints.emptyBody')}
          actionLabel={t('waypoints.addSample')}
          onAction={() => void addDemo()}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="screen.waypoints" title={t('tabs.waypoints')} subtitle={t('waypoints.subtitle')}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void setGoTo(waypointToTarget(item));
              navigation.navigate('Map');
            }}
            onLongPress={() => confirmDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatCoordinates(coordFormat, item.latitude, item.longitude)}`}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.md, minHeight: minTouch }]}
            testID={`waypoints.row.${item.id}`}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.coords, { color: colors.textMuted }]}>{formatCoordinates(coordFormat, item.latitude, item.longitude)}</Text>
            </View>
            <StatusBadge label={t(`waypoints.types.${item.type}` as 'waypoints.types.generic')} variant="neutral" />
          </Pressable>
        )}
      />
      <Button label={t('waypoints.openMap')} variant="secondary" onPress={() => navigation.navigate('Map')} testID="waypoints.openMap" />
      <Text style={[styles.hint, { color: colors.textMuted, marginTop: spacing.md }]}>{t('waypoints.tapGoTo')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  coords: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
